// AGY 1.4.4 stores one SQLite trajectory per conversation, with CortexStep protobuf payloads.
// Read only the measured message fields; unknown step types remain visible to the drift tally.
import { Database } from "bun:sqlite";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import type { JsonValue } from "../json.ts";
import { NO_CURSOR, type Cursor, type ReadSince } from "./cursor.ts";
import { containedRealpath, FIRST_TAIL_BYTES, FIRST_TAIL_ROWS, MAX_TRANSCRIPT_BYTES, rootList, statFile } from "./files.ts";
import { createUnknownCounter, NO_CHANGE, noQueue, parseWith, type Reduction, type RowReducer } from "./reduce.ts";
import { clamp, MAX_RESULT_CHARS, MAX_TEXT_CHARS, stripAnsi, summarizeToolInput } from "./text.ts";
import { classifyToolCall } from "./tool-call.ts";
import type { AgentSessionRef, DiscoverHints, JournalAdapter, TranscriptEntry, TranscriptPart, TranscriptSource } from "./types.ts";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STEP_BYTES = 4 * 1024 * 1024;
const exec = promisify(execFile);
type ProtoField = { field: number; value: number | Uint8Array };

/** The bounded protobuf wire reader only descends into fields named below, never arbitrary data. */
function proto(raw: Uint8Array): ProtoField[] {
  let at = 0;
  function integer(): number {
    let value = 0n;
    for (let shift = 0n; shift < 70n && at < raw.length; shift += 7n) {
      const byte = raw[at++]!;
      value |= BigInt(byte & 127) << shift;
      if (byte < 128) {
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("oversized protobuf integer");
        return Number(value);
      }
    }
    throw new Error("truncated protobuf integer");
  }
  const fields: ProtoField[] = [];
  while (at < raw.length) {
    if (fields.length >= 1024) throw new Error("too many protobuf fields");
    const tag = integer();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    if (field === 0) throw new Error("invalid protobuf field");
    if (wire === 0) fields.push({ field, value: integer() });
    else if (wire === 2 || wire === 1 || wire === 5) {
      const length = wire === 2 ? integer() : wire === 1 ? 8 : 4;
      if (length > raw.length - at) throw new Error("truncated protobuf field");
      if (wire === 2) fields.push({ field, value: raw.subarray(at, at + length) });
      at += length;
    } else throw new Error("unsupported protobuf wire type");
  }
  return fields;
}

function bytes(fields: ProtoField[], field: number): Uint8Array {
  const value = fields.find((item) => item.field === field)?.value;
  return value instanceof Uint8Array ? value : new Uint8Array();
}

function string(fields: ProtoField[], field: number): string {
  return stripAnsi(new TextDecoder("utf-8", { fatal: true }).decode(bytes(fields, field)));
}

function textPart(kind: "text" | "thinking", value: string): TranscriptPart[] {
  return value.trim() ? [{ kind, ...clamp(value, MAX_TEXT_CHARS) }] : [];
}

function stepEntry(idx: number, type: number, payload: Uint8Array): TranscriptEntry | null {
  const step = proto(payload);
  if (step.find((item) => item.field === 1)?.value !== type) return null;
  const meta = proto(bytes(step, 5));
  const time = proto(bytes(meta, 1));
  const seconds = time.find((item) => item.field === 1)?.value;
  const date = typeof seconds === "number" ? new Date(seconds * 1000) : null;
  const ts = date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  let role: TranscriptEntry["role"] = "assistant";
  let parts: TranscriptPart[] = [];
  if (type === 14) {
    role = "user";
    parts = textPart("text", string(proto(bytes(step, 19)), 2));
  } else if (type === 15) {
    const message = proto(bytes(step, 20));
    // Field 8 repeats the rendered answer. Field 7's calls reappear as tool steps: show each once.
    parts = [...textPart("thinking", string(message, 3)), ...textPart("text", string(message, 1))];
  } else if (type === 23) {
    role = "summary";
    parts = textPart("text", string(proto(bytes(step, 30)), 5));
  } else if (type === 132) {
    const call = proto(bytes(meta, 4));
    const name = string(call, 2);
    if (!name) return null;
    const input = string(call, 3);
    let args: JsonValue = input;
    try {
      // SAFETY: JSON.parse returns JSON values; the tool classifier validates their shape.
      args = JSON.parse(input) as JsonValue;
    } catch { /* Keep a malformed input as the native string. */ }
    const summary = summarizeToolInput(args);
    const tool: Extract<TranscriptPart, { kind: "tool" }> = {
      kind: "tool", name, summary, call: classifyToolCall(name, args, summary),
    };
    const id = string(call, 1);
    if (id) tool.id = id;
    const output = string(proto(bytes(proto(bytes(step, 140)), 2)), 1);
    const error = string(proto(bytes(step, 31)), 2);
    if (error) tool.result = { ...clamp(error, MAX_RESULT_CHARS), isError: true };
    else if (output) tool.result = clamp(output, MAX_RESULT_CHARS);
    parts = [tool];
  }
  if (parts.length === 0) return null;
  return { uuid: `agy-${idx}`, ts, role, parts };
}

export function createAgyReducer(): RowReducer {
  const unknown = createUnknownCounter({ rows: ["14", "15", "23", "132"], roles: [], parts: [] });
  function push(line: string): Reduction {
    try {
      // SAFETY: JSON.parse is an untrusted JSON boundary; every field is checked before use.
      const row = JSON.parse(line) as JsonValue;
      if (row === null || typeof row !== "object" || Array.isArray(row)) return NO_CHANGE;
      if (typeof row.type !== "number") return NO_CHANGE;
      unknown.row(String(row.type));
      if (row.format !== 0) unknown.row(`format:${String(row.format)}`);
      if (typeof row.idx !== "number" || !Number.isSafeInteger(row.idx) || row.idx < 0 || row.format !== 0
        || typeof row.payload !== "string" || row.payload.length > MAX_STEP_BYTES * 1.34
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(row.payload)) return NO_CHANGE;
      const entry = stepEntry(row.idx, row.type, Buffer.from(row.payload, "base64"));
      return entry ? { added: [entry], changed: [] } : NO_CHANGE;
    } catch { return NO_CHANGE; }
  }
  return { push, queued: noQueue, unknowns: unknown.tally };
}

type StepRow = { idx: number; type: number; format: number; payload: Uint8Array };
function withDb<T>(path: string, read: (db: Database) => T): T | null {
  let db: Database | undefined;
  try {
    // AGY removes its WAL on close but leaves WAL mode in the header. Avoid creating side files.
    const uri = pathToFileURL(path);
    uri.search = "mode=ro&immutable=1";
    db = new Database(existsSync(`${path}-wal`) ? path : uri.href, { readonly: true });
    return read(db);
  } catch { return null; }
  finally { db?.close(); }
}

export class AgyTranscriptSource implements TranscriptSource {
  readonly roots: string[];
  constructor(roots: string | readonly string[]) { this.roots = rootList(roots); }

  async resolve(ref: AgentSessionRef): Promise<string | null> {
    if (ref.kind !== "id" || !SESSION_ID.test(ref.value)) return null;
    for (const root of this.roots) {
      const path = await containedRealpath(join(root, "conversations", `${ref.value}.db`), root);
      if (path !== null && withDb(path, (db) => db.query("select idx from steps limit 1").get()) !== null) return path;
    }
    return null;
  }

  private async contained(key: string): Promise<string | null> {
    for (const root of this.roots) {
      const path = await containedRealpath(key, join(root, "conversations"));
      if (path !== null && SESSION_ID.test(path.split(/[/\\]/).pop()?.replace(/\.db$/, "") ?? "")) return path;
    }
    return null;
  }

  async stat(key: string): Promise<{ size: number; mtimeMs: number } | null> {
    const path = await this.contained(key);
    if (path === null) return null;
    const db = await statFile(path);
    const wal = await statFile(`${path}-wal`);
    return db ? { size: db.size + (wal?.size ?? 0), mtimeMs: Math.max(db.mtimeMs, wal?.mtimeMs ?? 0) } : null;
  }

  private async read(key: string, cap: number, limit: number) {
    const path = await this.contained(key);
    const meta = await this.stat(key);
    if (path === null || meta === null) return null;
    const data = withDb(path, (db) => {
      const lines: string[] = [];
      const total = db.query<{ total: number }, []>("select count(*) as total from steps").get()?.total ?? 0;
      let size = 0;
      for (const row of db.query<StepRow, [number, number]>(
        "select idx, step_type as type, step_format as format, step_payload as payload from steps where length(step_payload) <= ? order by idx desc limit ?",
      ).iterate(MAX_STEP_BYTES, limit)) {
        const line = JSON.stringify({ ...row, payload: Buffer.from(row.payload).toString("base64") });
        size += Buffer.byteLength(line);
        if (size > cap) break;
        lines.push(line);
      }
      lines.reverse();
      return { lines, complete: lines.length === total, ...meta };
    });
    const after = await this.stat(key);
    // An immutable read takes no file lock: discard a snapshot if a native writer moved underneath it.
    return after?.mtimeMs === meta.mtimeMs && after.size === meta.size ? data : null;
  }

  async load(key: string) {
    const data = await this.read(key, MAX_TRANSCRIPT_BYTES, 10000);
    return data ? { ...data, text: data.lines.join("\n") } : { text: "", complete: true, size: 0, mtimeMs: 0 };
  }

  async readSince(key: string, cursor: Cursor): Promise<ReadSince> {
    // shortcut: mutable steps reset the bounded tail; use native row revisions if large sessions make this costly.
    const data = await this.read(key, FIRST_TAIL_BYTES, FIRST_TAIL_ROWS);
    return data ? { lines: data.lines, cursor: NO_CURSOR, reset: true, fromStart: data.complete }
      : { lines: [], cursor, reset: false, fromStart: false };
  }
}

type OpenFiles = (pid: number) => Promise<string>;
const openFiles: OpenFiles = async (pid) => (await exec("lsof", ["-nP", "-a", "-p", String(pid), "-Fn"], {
  timeout: 1000, maxBuffer: 1024 * 1024, windowsHide: true,
})).stdout;

/** Bind to the process-held presence lock, never the newest database in a shared workspace. */
export function agyJournal(roots: string | readonly string[], files: OpenFiles = openFiles): JournalAdapter {
  const source = new AgyTranscriptSource(roots);
  const cache = new Map<number, { at: number; paths: string[] }>();
  async function discover(_cwd: string, hints?: DiscoverHints): Promise<AgentSessionRef | null> {
    for (const proc of hints?.processes ?? []) {
      const name = proc.argv[0]?.split(/[/\\]/).pop()?.replace(/\.exe$/i, "");
      if (name !== "agy" && name !== "antigravity") continue;
      const index = proc.argv.indexOf("--conversation");
      const arg = proc.argv.find((value) => value.startsWith("--conversation="))?.slice(15)
        ?? (index >= 0 ? proc.argv[index + 1] : undefined);
      if (!proc.pid && arg && SESSION_ID.test(arg)) {
        const ref = { kind: "id" as const, value: arg };
        if (await source.resolve(ref)) return ref;
      }
      if (!proc.pid || !Number.isSafeInteger(proc.pid) || proc.pid <= 0) continue;
      try {
        let held = cache.get(proc.pid);
        if (!held || Date.now() - held.at > 1000) {
          held = { at: Date.now(), paths: (await files(proc.pid)).split("\n").filter((line) => line.startsWith("n")).map((line) => line.slice(1)) };
          if (cache.size >= 64) cache.clear();
          cache.set(proc.pid, held);
        }
        for (const root of source.roots) {
          const ids: string[] = [];
          for (const path of held.paths) {
            const id = path.split(/[/\\]/).pop()?.replace(/\.lock$/, "") ?? "";
            if (!path.endsWith(".lock") || !SESSION_ID.test(id)) continue;
            if (await containedRealpath(path, join(root, "presence"))) ids.push(id);
          }
          if (ids.length !== 1) continue;
          const ref = { kind: "id" as const, value: ids[0]! };
          if (await source.resolve(ref)) return ref;
        }
      } catch { /* Missing lsof or an exited process leaves the native terminal available. */ }
    }
    return null;
  }
  return { agent: "agy", source, discover, parse: (text) => parseWith(createAgyReducer(), text), reducer: createAgyReducer };
}
