// Cursor Agent's journal adapter.
//
// SHAPE OF THE SOURCE (verified against on-disk sessions, 2026-09-22):
//   ~/.cursor/projects/<project-slug>/agent-transcripts/<session-uuid>/<session-uuid>.jsonl
//   {"role":"user","message":{"content":[{"type":"text","text":"<timestamp>…</timestamp>\n<user_query>…</user_query>"}]}}
//   {"role":"assistant","message":{"content":[{"type":"text","text":"…"},{"type":"tool_use","name":"Shell","input":{…}}]}}
//
// THREE THINGS THIS FORMAT DOES NOT RECORD, and each shapes what the history can show:
//  - No row ids, so the paging cursor is synthesised from the row's own bytes (see {@link cursorRowId}).
//  - No timestamps of its own. The `<timestamp>` a user row opens with is prose in the operator's
//    locale ("Tuesday, Sep 15, 2026, 8:53 PM (UTC+8)"), not a machine field, and parsing prose into
//    a claim about when a turn happened is a guess — `ts` stays empty rather than being invented.
//  - No tool RESULTS. A call is logged, its output never is, so a tool part here carries the call
//    and no `result`. Nothing is missing from the read; the file has it not.
//
// Where Herdr's id comes from: the cursor integration reports Cursor's own `session_id` (kind `id`),
// which is BOTH the transcript's directory name and its file name. It needs
// `herdr integration install cursor`.

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { JsonObject, JsonValue } from "../json.ts";
import {
  parseWith,
  createUnknownCounter,
  type KnownTypes,
  NO_CHANGE,
  noQueue,
  type Reduction,
  type RowReducer,
} from "./reduce.ts";
import { containedRealpath, exists, loadTail, readSinceFile, rootList, statFile } from "./files.ts";
import { clamp, extractUserQuery, MAX_TEXT_CHARS, stripAnsi, summarizeToolInput } from "./text.ts";
import { classifyToolCall } from "./tool-call.ts";
import type {
  AgentSessionRef,
  JournalAdapter,
  TranscriptEntry,
  TranscriptPart,
  TranscriptSource,
} from "./types.ts";

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCursorSessionId(value: string): boolean {
  return SESSION_ID_RE.test(value);
}

/**
 * A stable per-row cursor, synthesised because Cursor's rows carry no id and `TranscriptEntry.uuid`
 * is the paging cursor (`?before=`).
 *
 * The row's own bytes rather than its position, for the reason codex.ts sets out at length: a log
 * over the byte cap is tail-read, so the window's first row is not the file's first row. The
 * occurrence counter disambiguates byte-identical rows, and it is advanced for EVERY row including
 * the ones that render nothing, so numbering is a function of the window alone.
 */
export function cursorRowId(line: string, seen: Map<string, number>): string {
  // djb2 — determinism and speed, not collision resistance; a collision costs a re-render.
  let hash = 5381;
  for (let i = 0; i < line.length; i++) hash = ((hash << 5) + hash + line.charCodeAt(i)) | 0;
  const key = (hash >>> 0).toString(36);
  const n = seen.get(key) ?? 0;
  seen.set(key, n + 1);
  return n === 0 ? `cu-${key}` : `cu-${key}-${n}`;
}

/** The `content` list of one row, or an empty list when the row isn't that shape. */
function contentParts(row: JsonObject): JsonObject[] {
  const message = row.message;
  if (message === null || typeof message !== "object" || Array.isArray(message)) return [];
  const content = message.content;
  if (!Array.isArray(content)) return [];
  return content.filter(
    (part): part is JsonObject => part !== null && typeof part === "object" && !Array.isArray(part),
  );
}

function partText(part: JsonObject): string {
  return typeof part.text === "string" ? stripAnsi(part.text) : "";
}

/**
 * Parse a Cursor `<session>.jsonl` into oldest-first turns. PURE — no fs, no clock.
 * Unparseable lines are skipped (live append, tail-read window).
 */
const CURSOR_KNOWN: KnownTypes = {
  rows: [],
  roles: ["user", "assistant"],
  parts: ["text", "tool_use"],
};

export function parseCursorTranscript(text: string): TranscriptEntry[] {
  return parseWith(createCursorReducer(), text);
}

export function createCursorReducer(): RowReducer {
  const seen = new Map<string, number>();
  const unknown = createUnknownCounter(CURSOR_KNOWN);

  function push(line: string): Reduction {
    if (line.trim() === "") return NO_CHANGE;
    let parsed: JsonValue;
    try {
      // SAFETY: `JSON.parse` output IS a JsonValue by construction — naming it keeps every field
      // read below a checked property access.
      parsed = JSON.parse(line) as JsonValue;
    } catch {
      return NO_CHANGE;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return NO_CHANGE;
    const row: JsonObject = parsed;
    unknown.role(row.role);
    const uuid = cursorRowId(line, seen);
    const parts = contentParts(row);
    for (const part of parts) unknown.part(part.type);

    if (row.role === "user") {
      // Only what the operator actually said. The same role carries the subagent catalog, the MCP
      // banner and a bare timestamp, and rendering those as "You" would put the system prompt on
      // the phone (1053 tagged rows against 15 untagged ones in the sessions this was read from).
      const spoken = parts.map(partText).map(extractUserQuery).find((q) => q !== null);
      if (spoken === undefined || spoken === null) return NO_CHANGE;
      return {
        added: [{ uuid, ts: "", role: "user", parts: [{ kind: "text", ...clamp(spoken, MAX_TEXT_CHARS) }] }],
        changed: NO_CHANGE.changed,
      };
    }

    if (row.role !== "assistant") return NO_CHANGE;
    const rendered: TranscriptPart[] = [];
    for (const part of parts) {
      if (part.type === "text") {
        const body = partText(part);
        if (body.trim() !== "") rendered.push({ kind: "text", ...clamp(body, MAX_TEXT_CHARS) });
        continue;
      }
      if (part.type !== "tool_use") continue;
      const name = typeof part.name === "string" ? part.name : "tool";
      const summary = summarizeToolInput(part.input);
      const tool: Extract<TranscriptPart, { kind: "tool" }> = {
        kind: "tool",
        name,
        summary,
        call: classifyToolCall(name, part.input, summary),
      };
      if (typeof part.id === "string" && part.id !== "") tool.id = part.id;
      rendered.push(tool);
    }
    if (rendered.length === 0) return NO_CHANGE;
    return {
      added: [{ uuid, ts: "", role: "assistant", parts: rendered }],
      changed: NO_CHANGE.changed,
    };
  }

  return { push, unknowns: unknown.tally, queued: noQueue };
}

/**
 * Scan `<root>/<project-slug>/agent-transcripts/<uuid>/<uuid>.jsonl`.
 *
 * Session uuids are unique, so trying each project directory for one named after the session is a
 * lookup rather than a guess — the same shape grok's source uses, and for the same reason: the
 * slug is a mangling of the project's path that we would otherwise have to reproduce exactly.
 */
export class CursorTranscriptSource implements TranscriptSource {
  // The scan is the expensive part and never changes; the ROOT it resolved through travels with the
  // hit, because containment is checked per root and must be re-checked on every later read (a file
  // replaced by an outward symlink after the first resolve is exactly what that catches).
  private readonly pathCache = new Map<string, { path: string; root: string }>();
  private readonly roots: string[];

  constructor(roots: string | readonly string[]) {
    this.roots = rootList(roots);
  }

  async resolve(ref: AgentSessionRef): Promise<string | null> {
    if (ref.kind !== "id" || !isCursorSessionId(ref.value)) return null;
    const sessionId = ref.value;
    const cached = this.pathCache.get(sessionId);
    if (cached !== undefined) {
      const real = await containedRealpath(cached.path, cached.root);
      if (real !== null) {
        if (real !== cached.path) this.pathCache.set(sessionId, { path: real, root: cached.root });
        return real;
      }
      this.pathCache.delete(sessionId);
    }

    for (const root of this.roots) {
      const hit = await this.findUnder(root, sessionId);
      if (hit === null) continue;
      this.pathCache.set(sessionId, { path: hit, root });
      return hit;
    }
    return null;
  }

  private async findUnder(root: string, sessionId: string): Promise<string | null> {
    let projects: string[];
    try {
      projects = await readdir(root);
    } catch {
      return null;
    }
    for (const project of projects) {
      const candidate = join(
        root,
        project,
        "agent-transcripts",
        sessionId,
        `${sessionId}.jsonl`,
      );
      if (!(await exists(candidate))) continue;
      return containedRealpath(candidate, root);
    }
    return null;
  }

  stat = statFile;
  load = loadTail;
  readSince = readSinceFile;
}

export function cursorJournal(roots: string | readonly string[]): JournalAdapter {
  return {
    agent: "cursor",
    source: new CursorTranscriptSource(roots),
    parse: parseCursorTranscript,
    reducer: createCursorReducer,
  };
}

// The cursor: one opaque token that says where a source got to, in that source's own language.
//
// ── WHY ONE CODEC AND NOT THREE SHAPES ───────────────────────────────────────
// The contract is `readSince(key, cursor)`, and the three storage kinds under it count position
// differently: a byte offset for the five harnesses that write a file, `max(time_updated)` for
// opencode's rows (which it mutates while a reply streams), and `max(id)` for hermes' append-only
// ones. Every one of those is ONE non-negative integer, so the shape they share is worth more than
// the names they don't. A single text token carries it, and the number's MEANING never leaves the
// adapter that wrote it.
//
// ── THE THREE FIELDS ARE THE THREE WAYS A CURSOR IS WRONG ────────────────────
// `<tag>:<position>:<keyHash>`
//
//  - `tag` — which counting this is. A cursor from another storage kind is REFUSED rather than
//    misread. A pane whose agent changed under a window that kept its cursor is what produces one.
//  - `position` — the number. Digits only, so a corrupted or hand-made token can never arrive as a
//    negative (which `Bun.file().slice` reads from the END of the file), a float, or `1e9`.
//  - `keyHash` — which source it was taken on. This is what makes Claude's hand-over free: when a
//    conversation rotates, `resolve` starts answering with a different path, the hash stops
//    matching, and the read resets. No hand-over code lives in the cursor at all. The same field
//    covers an opencode session that moved database.
//
// The key is HASHED, not carried. A cursor is positioning and never authority, so identity is the
// only question asked of this field, and a hash answers it while keeping an operator's home
// directory out of a value the live window may log or put on the wire. Refusing a cursor is always
// the safe direction: the read resets, which shows the operator their session again rather than
// less of it.

/**
 * Where a source got to. OPAQUE above the source that made it: pass it back verbatim, and never
 * read inside it. Only this module and the one adapter that wrote it may.
 */
export type Cursor = string;

/** "I hold nothing yet." Every source answers this with a bounded tail and `reset: true`. */
export const NO_CURSOR: Cursor = "";

/** Which counting a cursor's number is. Named by STORAGE, not by harness: four share `bytes`. */
export type CursorTag = "bytes" | "updated" | "rowid";

/** One source's answer to "what is new". */
export interface ReadSince {
  /** Complete rows in source order, never a fragment. Empty when nothing moved. */
  readonly lines: readonly string[];
  /** Where to resume. */
  readonly cursor: Cursor;
  /**
   * Throw away what you hold: `lines` is the whole truth now, not an append to it.
   *
   * One flag for every reason a read is not an append — a first read, a truncated file, a rewritten
   * database, a cursor left too far behind to catch up on, and Claude's hand-over to a new log.
   */
  readonly reset: boolean;
  /**
   * `lines[0]` is the source's OWN first row: there is nothing before this answer.
   *
   * Only a {@link reset} can say it, and it is the one fact a caller cannot work out for itself. A
   * reset answer is a bounded tail, and "a tail" and "the whole thing" look identical from above —
   * so a window that guessed would either offer to load turns that do not exist, or hide turns that
   * do. The source knows, because it is the side that applied the bound: a file read that started
   * at byte 0, or a query whose row count came in under its limit.
   *
   * False on an append, always. A row arriving after a row cannot be the first one.
   */
  readonly fromStart: boolean;
}

/** Position field: digits only. See "the three ways a cursor is wrong" in this file's header. */
const POSITION = /^\d+$/;

function hashKey(key: string): string {
  return Bun.hash(key).toString(36);
}

export function encodeCursor(tag: CursorTag, key: string, position: number): Cursor {
  return `${tag}:${position}:${hashKey(key)}`;
}

/**
 * The position this cursor holds for `key`, or null when it is absent, foreign or unusable.
 *
 * Null is one answer for all four, on purpose: every one of them means the same thing to a caller,
 * which is "you cannot resume from this, take a fresh tail".
 */
export function decodeCursor(cursor: Cursor, tag: CursorTag, key: string): number | null {
  const fields = cursor.split(":");
  if (fields.length !== 3 || fields[0] !== tag || fields[2] !== hashKey(key)) return null;
  const digits = fields[1] ?? "";
  if (!POSITION.test(digits)) return null;
  const position = Number(digits);
  return Number.isSafeInteger(position) ? position : null;
}
