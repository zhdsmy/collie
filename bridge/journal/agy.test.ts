import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agyJournal, AgyTranscriptSource, createAgyReducer } from "./agy.ts";
import { NO_CURSOR } from "./cursor.ts";

// Synthetic content in the native 1.4.4 wire schema: no user conversation or credentials.
const ID = "11111111-2222-3333-4444-555555555555";
const OTHER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
function integer(n: number): Buffer {
  const bytes: number[] = [];
  do { bytes.push((n % 128) | (n >= 128 ? 128 : 0)); n = Math.floor(n / 128); } while (n);
  return Buffer.from(bytes);
}
function field(n: number, value: number | string | Uint8Array): Buffer {
  if (typeof value === "number") return Buffer.concat([integer(n * 8), integer(value)]);
  const data = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  return Buffer.concat([integer(n * 8 + 2), integer(data.length), data]);
}
const message = (...fields: Buffer[]) => Buffer.concat(fields);
function step(type: number, body: Buffer, meta: Buffer = Buffer.alloc(0)) {
  return message(field(1, type), field(4, 3), field(5, message(field(1, field(1, 1792598450)), meta)), body);
}
const user = step(14, field(19, field(2, "Hello\n\n保留段落。")));
const answer = step(15, field(20, message(field(1, "A **native** reply."), field(3, "Check the facts."), field(8, "A **native** reply."))));
const tool = step(132, field(140, field(2, field(1, "Command exited with code 0."))),
  field(4, message(field(1, "call-1"), field(2, "run_command"), field(3, '{"CommandLine":"pwd"}'))));
function row(idx: number, type: number, payload: Uint8Array, format = 0) {
  return JSON.stringify({ idx, type, format, payload: Buffer.from(payload).toString("base64") });
}

describe("AGY native steps", () => {
  test("preserves paragraphs, reasoning, answers and stable per-step identity without duplicate answers", () => {
    const entries = agyJournal([]).parse([row(0, 14, user), row(1, 15, answer), row(2, 132, tool)].join("\n"));
    expect(entries.map((entry) => entry.uuid)).toEqual(["agy-0", "agy-1", "agy-2"]);
    expect(entries[0]?.role).toBe("user");
    expect(entries[0]?.parts).toEqual([{ kind: "text", text: "Hello\n\n保留段落。" }]);
    expect(entries[0]?.ts).toBe("2026-10-21T16:00:50.000Z");
    expect(entries[1]?.parts).toEqual([
      { kind: "thinking", text: "Check the facts." }, { kind: "text", text: "A **native** reply." },
    ]);
    expect(entries[2]?.parts[0]).toMatchObject({ kind: "tool", id: "call-1", name: "run_command", result: { text: "Command exited with code 0." } });
  });

  test("renders compaction separately and native tool errors as failures", () => {
    const summary = step(23, field(30, field(5, "Earlier context.")));
    const error = Buffer.concat([tool, field(31, field(2, "file does not exist"))]);
    const entries = agyJournal([]).parse([row(3, 23, summary), row(4, 132, error)].join("\n"));
    expect(entries[0]).toMatchObject({ role: "summary", parts: [{ kind: "text", text: "Earlier context." }] });
    expect(entries[1]?.parts[0]).toMatchObject({ result: { text: "file does not exist", isError: true } });
  });

  test("declines truncated, malformed and unsupported records and counts new native types", () => {
    const reducer = createAgyReducer();
    for (const line of ["bad json", "null", row(-1, 14, user), row(0, 14, user, 1),
      row(0, 14, user.subarray(0, user.length - 1)), row(0, 14, Buffer.from([0])),
      JSON.stringify({ idx: 0, type: 14, format: 0, payload: "not base64!" }), row(0, 999, user)]) {
      expect(reducer.push(line).added).toEqual([]);
    }
    expect(reducer.unknowns().rows.get("999")).toBe(1);
    expect(reducer.push(row(0, 14, user)).added).toHaveLength(1);
  });
});

const temps: string[] = [];
afterEach(async () => { await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function home() {
  const root = await mkdtemp(join(tmpdir(), "collie-agy-journal-")); temps.push(root);
  await mkdir(join(root, "conversations")); await mkdir(join(root, "presence"));
  return root;
}
function database(root: string, id = ID) {
  const path = join(root, "conversations", `${id}.db`);
  const db = new Database(path);
  db.run("create table steps (idx integer primary key, step_type integer, step_format integer, step_payload blob)");
  db.run("insert into steps values (0,14,0,?)", [user]);
  db.run("insert into steps values (1,15,0,?)", [answer]);
  return { path, db };
}

describe("AGY read-only source and exact discovery", () => {
  test("reads the same transcript for Chat and History, including an in-place streaming edit", async () => {
    const root = await home(); const { path, db } = database(root);
    try {
      const source = new AgyTranscriptSource(root);
      expect(await source.resolve({ kind: "id", value: ID })).toBe(path);
      const first = await source.readSince(path, NO_CURSOR);
      expect(first.reset).toBe(true); expect(first.fromStart).toBe(true);
      const parse = agyJournal([]).parse;
      expect(parse((await source.load(path)).text)).toEqual(parse(first.lines.join("\n")));
      const edited = step(15, field(20, field(1, "The streamed reply is complete.")));
      db.run("update steps set step_payload = ? where idx = 1", [edited]);
      const next = await source.readSince(path, first.cursor);
      expect(next.reset).toBe(true);
      expect(parse(next.lines.join("\n"))[1]).toMatchObject({ uuid: "agy-1", parts: [{ kind: "text", text: "The streamed reply is complete." }] });
      expect(db.query("select count(*) as n from steps").get()).toEqual({ n: 2 });
    } finally { db.close(); }
  });

  test("rejects traversal, path refs, foreign keys and symlinks out of the root", async () => {
    const root = await home(); const outside = await home(); const { path, db } = database(outside); db.close();
    const source = new AgyTranscriptSource(root);
    await symlink(path, join(root, "conversations", `${ID}.db`));
    expect(await source.resolve({ kind: "id", value: ID })).toBeNull();
    expect(await source.resolve({ kind: "id", value: "../outside" })).toBeNull();
    expect(await source.resolve({ kind: "path", value: path })).toBeNull();
    expect(await source.stat(path)).toBeNull();
    expect((await source.load(path)).text).toBe("");
  });

  test("reads committed WAL rows instead of ignoring an active WAL", async () => {
    const root = await home(); const { path, db } = database(root);
    try {
      db.run("pragma journal_mode=wal");
      db.run("update steps set step_payload = ? where idx = 1", [step(15, field(20, field(1, "Answer from WAL.")))]);
      const adapter = agyJournal(root);
      const data = await adapter.source.load(path);
      expect(adapter.parse(data.text)[1]?.parts).toEqual([{ kind: "text", text: "Answer from WAL." }]);
    } finally { db.close(); }
  });

  test("binds the process's lock, not newer neighbouring sessions or a stale --conversation argument", async () => {
    const root = await home(); const { db } = database(root); db.close();
    const other = database(root, OTHER); other.db.close();
    const lock = join(root, "presence", `${ID}.lock`); await writeFile(lock, "");
    const adapter = agyJournal(root, async () => `p42\nn${lock}\n`);
    const hints = { shared: true as const, processes: [{ pid: 42, argv: ["/bin/antigravity", "--conversation", OTHER] }] };
    expect(await adapter.discover!("/same-workspace", hints)).toEqual({ kind: "id", value: ID });
    expect(await adapter.discover!("/same-workspace", { processes: [] })).toBeNull();
    expect(await adapter.discover!("/same-workspace", { processes: [{ argv: ["agy", "--conversation", OTHER] }] })).toEqual({ kind: "id", value: OTHER });
  });

  test("fails closed on missing lsof, multiple locks and a foreign process's lock", async () => {
    const root = await home(); const foreign = await home(); const { db } = database(root); db.close();
    const hints = { processes: [{ pid: 42, argv: ["agy"] }] };
    expect(await agyJournal(root, async () => { throw new Error("unavailable"); }).discover!("/cwd", hints)).toBeNull();
    const lock = join(root, "presence", `${ID}.lock`); const other = join(root, "presence", `${OTHER}.lock`);
    await writeFile(lock, ""); await writeFile(other, "");
    expect(await agyJournal(root, async () => `n${lock}\nn${other}\n`).discover!("/cwd", hints)).toBeNull();
    const outside = join(foreign, "presence", `${ID}.lock`); await writeFile(outside, "");
    expect(await agyJournal(root, async () => `n${outside}\n`).discover!("/cwd", hints)).toBeNull();
  });
});
