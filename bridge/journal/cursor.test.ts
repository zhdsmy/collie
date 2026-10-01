import { appendFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

import {
  CursorTranscriptSource,
  decodeCursor,
  encodeCursor,
  isCursorSessionId,
  NO_CURSOR,
  parseCursorTranscript,
} from "./cursor.ts";

const SID = "6d9e0432-f5f5-4078-90f4-71642918d097";
const OTHER = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const user = (text: string) => JSON.stringify({ role: "user", message: { content: [{ type: "text", text }] } });
const assistant = (...content: unknown[]) => JSON.stringify({ role: "assistant", message: { content } });

describe("isCursorSessionId", () => {
  test("accepts the uuid Herdr's cursor integration reports", () => {
    expect(isCursorSessionId(SID)).toBe(true);
  });

  test("rejects anything that is not a uuid before it can touch the filesystem", () => {
    for (const value of ["../../etc/passwd", "agent-transcripts", "", `${SID}.jsonl`]) {
      expect(isCursorSessionId(value)).toBe(false);
    }
  });
});

describe("parseCursorTranscript", () => {
  test("keeps the operator's words and drops the plumbing sharing their role", () => {
    const log = [
      user("<timestamp>Tuesday, Sep 22, 2026, 8:53 AM (UTC+8)</timestamp>"),
      user("<available_subagent_types>\ngeneralPurpose: …\n</available_subagent_types>"),
      user("<timestamp>Tuesday, Sep 22, 2026, 8:54 AM (UTC+8)</timestamp>\n<user_query>\nadd history\n</user_query>"),
    ].join("\n");
    expect(parseCursorTranscript(log)).toEqual([
      { uuid: expect.any(String), ts: "", role: "user", parts: [{ kind: "text", text: "add history" }] },
    ]);
  });

  test("renders assistant prose and its tool calls as one turn", () => {
    const log = assistant(
      { type: "text", text: "Looking at the registry." },
      { type: "tool_use", name: "Shell", input: { command: "rg -n cursor bridge/journal", description: "search" } },
      { type: "tool_use", name: "Read", input: { path: "/tmp/a.ts" } },
    );
    const [entry] = parseCursorTranscript(log);
    expect(entry?.role).toBe("assistant");
    expect(entry?.parts).toEqual([
      { kind: "text", text: "Looking at the registry." },
      {
        kind: "tool",
        name: "Shell",
        summary: "rg -n cursor bridge/journal",
        call: { kind: "execute", command: "rg -n cursor bridge/journal", description: "search" },
      },
      { kind: "tool", name: "Read", summary: "/tmp/a.ts", call: { kind: "read", path: "/tmp/a.ts" } },
    ]);
  });

  test("survives a clipped head, a blank line and a row that is not an object", () => {
    const log = ['{"role":"assist', "", "42", assistant({ type: "text", text: "still here" })].join("\n");
    expect(parseCursorTranscript(log).map((e) => e.role)).toEqual(["assistant"]);
  });

  test("gives byte-identical rows distinct cursors and repeats them across reads", () => {
    const log = [assistant({ type: "text", text: "same" }), assistant({ type: "text", text: "same" })].join("\n");
    const ids = parseCursorTranscript(log).map((e) => e.uuid);
    expect(new Set(ids).size).toBe(2);
    expect(parseCursorTranscript(log).map((e) => e.uuid)).toEqual(ids);
  });

  test("emits nothing for an assistant turn that carried no renderable part", () => {
    expect(parseCursorTranscript(assistant({ type: "text", text: "  " }))).toEqual([]);
  });
});

describe("CursorTranscriptSource", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
  });

  async function root(): Promise<string> {
    const dir = await realpath(await mkdtemp(join(tmpdir(), "collie-cursor-")));
    dirs.push(dir);
    return join(dir, "projects");
  }

  async function writeSession(projects: string, slug: string, id: string): Promise<string> {
    const dir = join(projects, slug, "agent-transcripts", id);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${id}.jsonl`);
    await writeFile(path, `${user("<user_query>\nhi\n</user_query>")}\n`);
    return path;
  }

  test("finds a session under whichever project slug holds it", async () => {
    const projects = await root();
    await writeSession(projects, "data-workspace-other", OTHER);
    const path = await writeSession(projects, "data-workspace-collie", SID);
    const source = new CursorTranscriptSource(projects);
    expect(await source.resolve({ kind: "id", value: SID })).toBe(path);
    // Cached, and still the same file when asked again.
    expect(await source.resolve({ kind: "id", value: SID })).toBe(path);
  });

  test("refuses a path ref, an unknown session and a non-uuid", async () => {
    const projects = await root();
    await writeSession(projects, "p", SID);
    const source = new CursorTranscriptSource(projects);
    expect(await source.resolve({ kind: "path", value: join(projects, "p") })).toBeNull();
    expect(await source.resolve({ kind: "id", value: OTHER })).toBeNull();
    expect(await source.resolve({ kind: "id", value: "../../etc/passwd" })).toBeNull();
  });

  test("refuses a transcript symlinked out of the root", async () => {
    const projects = await root();
    const outside = await realpath(await mkdtemp(join(tmpdir(), "collie-outside-")));
    dirs.push(outside);
    const secret = join(outside, "secret.jsonl");
    await writeFile(secret, `${user("<user_query>\nleak\n</user_query>")}\n`);
    const dir = join(projects, "p", "agent-transcripts", SID);
    await mkdir(dir, { recursive: true });
    await symlink(secret, join(dir, `${SID}.jsonl`));
    expect(await new CursorTranscriptSource(projects).resolve({ kind: "id", value: SID })).toBeNull();
  });

  test("has nothing to serve when no root is configured", async () => {
    expect(await new CursorTranscriptSource([]).resolve({ kind: "id", value: SID })).toBeNull();
    expect(await new CursorTranscriptSource("/nope/cursor").resolve({ kind: "id", value: SID })).toBeNull();
  });

  test("reads only complete rows appended after the first bounded read", async () => {
    const projects = await root();
    const path = await writeSession(projects, "data-workspace-collie", SID);
    const source = new CursorTranscriptSource(projects);
    const key = await source.resolve({ kind: "id", value: SID });
    if (key === null) throw new Error("Cursor session did not resolve");

    const first = await source.readSince(key, NO_CURSOR);
    expect(first.reset).toBe(true);
    expect(parseCursorTranscript(first.lines.join("\n")).map((entry) => entry.parts[0]?.kind === "text" ? entry.parts[0].text : "")).toEqual(["hi"]);

    await appendFile(path, `${user("<user_query>\nnext\n</user_query>")}\n`);
    const next = await source.readSince(key, first.cursor);
    expect(next.reset).toBe(false);
    expect(parseCursorTranscript(next.lines.join("\n")).map((entry) => entry.parts[0]?.kind === "text" ? entry.parts[0].text : "")).toEqual(["next"]);
  });
});

// The generic codec used by every file journal.

// The codec is the one place a cursor can be wrong on purpose. Each test here is one of the three
// fields refusing its own kind of wrong, because every refusal costs a reset and a reset that fires
// for the wrong reason shows the operator less of their session than they had.

const KEY = "/home/someone/.claude/projects/a/b.jsonl";

describe("the cursor codec", () => {
  test("round-trips a position for the key it was taken on", () => {
    expect(decodeCursor(encodeCursor("bytes", KEY, 4096), "bytes", KEY)).toBe(4096);
  });

  test("round-trips zero, which is a real position and not an absent one", () => {
    expect(decodeCursor(encodeCursor("rowid", KEY, 0), "rowid", KEY)).toBe(0);
  });

  test("carries no path, so nothing that logs a cursor logs a home directory", () => {
    const cursor = encodeCursor("bytes", KEY, 12);
    expect(cursor).not.toContain("someone");
    expect(cursor).not.toContain("/");
  });

  test("the empty cursor decodes to nothing, which is what a first read passes", () => {
    expect(decodeCursor(NO_CURSOR, "bytes", KEY)).toBeNull();
  });

  test("refuses a cursor taken on another key — Claude's hand-over, for free", () => {
    const cursor = encodeCursor("bytes", KEY, 900);
    expect(decodeCursor(cursor, "bytes", "/home/someone/.claude/projects/a/c.jsonl")).toBeNull();
  });

  test("refuses a cursor from another counting, so a number is never misread", () => {
    const cursor = encodeCursor("updated", KEY, 900);
    expect(decodeCursor(cursor, "bytes", KEY)).toBeNull();
    expect(decodeCursor(cursor, "rowid", KEY)).toBeNull();
  });

  // Digits only. A negative position is the one that matters: `Bun.file().slice(-5)` reads from the
  // END of the file, so a negative offset would silently read the wrong window rather than fail.
  // Each case here carries the REAL key hash, so the refusal under test is the position field's.
  const HASH = encodeCursor("bytes", KEY, 1).split(":")[2] ?? "";

  test.each([
    ["a negative position", "bytes:-5"],
    ["an empty position", "bytes:"],
    ["exponent notation", "bytes:1e9"],
    ["a float", "bytes:1.5"],
    ["a leading space", "bytes: 1"],
    ["a word", "bytes:many"],
    ["a number past the safe integer range", "bytes:99999999999999999999"],
  ])("refuses %s", (_label, head) => {
    expect(decodeCursor(`${head}:${HASH}`, "bytes", KEY)).toBeNull();
  });

  test.each([
    ["too few fields", "bytes:1"],
    ["too many fields", `bytes:1:${HASH}:more`],
    ["rubbish", "not-a-cursor"],
    ["a bare number", "12"],
  ])("refuses %s", (_label, raw) => {
    expect(decodeCursor(raw, "bytes", KEY)).toBeNull();
  });
});
