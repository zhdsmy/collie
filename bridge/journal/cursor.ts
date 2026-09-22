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
import { containedRealpath, exists, loadTail, rootList, statFile } from "./files.ts";
import { clamp, extractUserQuery, MAX_TEXT_CHARS, stripAnsi, summarizeToolInput } from "./text.ts";
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
export function parseCursorTranscript(text: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  const seen = new Map<string, number>();

  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let parsed: JsonValue;
    try {
      // SAFETY: `JSON.parse` output IS a JsonValue by construction — naming it keeps every field
      // read below a checked property access.
      parsed = JSON.parse(line) as JsonValue;
    } catch {
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const row: JsonObject = parsed;
    const uuid = cursorRowId(line, seen);
    const parts = contentParts(row);

    if (row.role === "user") {
      // Only what the operator actually said. The same role carries the subagent catalog, the MCP
      // banner and a bare timestamp, and rendering those as "You" would put the system prompt on
      // the phone (1053 tagged rows against 15 untagged ones in the sessions this was read from).
      const spoken = parts.map(partText).map(extractUserQuery).find((q) => q !== null);
      if (spoken === undefined || spoken === null) continue;
      entries.push({
        uuid,
        ts: "",
        role: "user",
        parts: [{ kind: "text", ...clamp(spoken, MAX_TEXT_CHARS) }],
      });
      continue;
    }

    if (row.role !== "assistant") continue;
    const rendered: TranscriptPart[] = [];
    for (const part of parts) {
      if (part.type === "text") {
        const body = partText(part);
        if (body.trim() !== "") rendered.push({ kind: "text", ...clamp(body, MAX_TEXT_CHARS) });
        continue;
      }
      if (part.type !== "tool_use") continue;
      rendered.push({
        kind: "tool",
        name: typeof part.name === "string" ? part.name : "tool",
        summary: summarizeToolInput(part.input),
      });
    }
    if (rendered.length > 0) entries.push({ uuid, ts: "", role: "assistant", parts: rendered });
  }

  return entries;
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
}

export function cursorJournal(roots: string | readonly string[]): JournalAdapter {
  return {
    agent: "cursor",
    source: new CursorTranscriptSource(roots),
    parse: parseCursorTranscript,
  };
}
