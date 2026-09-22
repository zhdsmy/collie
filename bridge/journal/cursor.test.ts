import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

import { CursorTranscriptSource, isCursorSessionId, parseCursorTranscript } from "./cursor.ts";

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
      { kind: "tool", name: "Shell", summary: "rg -n cursor bridge/journal" },
      { kind: "tool", name: "Read", summary: "/tmp/a.ts" },
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
});
