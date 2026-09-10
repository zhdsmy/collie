import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  HermesTranscriptSource,
  isHermesSessionId,
  parseHermesTranscript,
  parseHermesSessionModel,
} from "./hermes.ts";

const SID = "20260909_154520_9e0b91";

describe("Hermes saved model display", () => {
  test("extracts only the full model and an explicitly recorded effort", () => {
    const model = "provider/example-model-with-a-long-name";
    expect(parseHermesSessionModel(model, JSON.stringify({ reasoning_config: { enabled: true, effort: "high" }, api_key: "private" })))
      .toEqual({ model, reasoningEffort: "high" });
    expect(parseHermesSessionModel(model, '{"reasoning_config":{"enabled":false,"effort":"high"}}'))
      .toEqual({ model, reasoningEffort: "none" });
    for (const config of [null, "{", "{}", '{"reasoning_config":null}', '{"reasoning_config":{"effort":"future"}}']) {
      expect(parseHermesSessionModel(model, config)).toEqual({ model });
    }
    expect(parseHermesSessionModel(null, "{}")).toBeNull();
    expect(parseHermesSessionModel("model\nother", "{}")).toBeNull();
  });

  test("reads only the exact session, refreshes changes and declines missing/unsafe refs", async () => {
    const root = await mkdtemp(join(tmpdir(), "collie-hermes-model-"));
    const db = new Database(join(root, "state.db"));
    try {
      db.run("create table sessions (id text primary key, model text, model_config text)");
      db.run("insert into sessions values (?, ?, ?)", [SID, "example-model", '{"reasoning_config":{"effort":"high"}}']);
      db.run("insert into sessions values (?, ?, ?)", ["20260910_110000_newer", "unrelated-model", "{}"]);
      const source = new HermesTranscriptSource(root);
      const ref = { kind: "id" as const, value: SID };
      expect(await source.sessionModel(ref)).toEqual({ model: "example-model", reasoningEffort: "high" });
      db.run("update sessions set model_config = ? where id = ?", ['{"reasoning_config":{"effort":"low"}}', SID]);
      expect(await source.sessionModel(ref)).toEqual({ model: "example-model", reasoningEffort: "low" });
      expect(await source.sessionModel({ kind: "id", value: "20260910_110000_missing" })).toBeNull();
      expect(await source.sessionModel({ kind: "path", value: join(root, "state.db") })).toBeNull();
      expect(await source.sessionModel({ kind: "id", value: "../state.db" })).toBeNull();
    } finally {
      db.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Hermes session ids", () => {
  test("accepts Hermes ids and rejects path-shaped input", () => {
    expect(isHermesSessionId(SID)).toBe(true);
    expect(isHermesSessionId("../../state.db")).toBe(false);
    expect(isHermesSessionId("2026_bad")).toBe(false);
  });
});

describe("parseHermesTranscript", () => {
  test("renders user, assistant, reasoning, tool call, and tool result rows", () => {
    const text = [
      JSON.stringify({ id: 1, role: "user", content: "show history", timestamp: 1 }),
      JSON.stringify({
        id: 2,
        role: "assistant",
        content: "I will inspect it.",
        reasoning: "Need read-only history.",
        tool_calls: JSON.stringify([{ id: "call-1", function: { name: "terminal", arguments: '{"command":"pwd"}' } }]),
        timestamp: 2,
      }),
      JSON.stringify({
        id: 3,
        role: "tool",
        tool_call_id: "call-1",
        tool_name: "terminal",
        content: "/home/james",
        timestamp: 3,
      }),
    ].join("\n");

    expect(parseHermesTranscript(text)).toEqual([
      { uuid: "1", ts: "1970-01-01T00:00:01.000Z", role: "user", parts: [{ kind: "text", text: "show history" }] },
      {
        uuid: "2",
        ts: "1970-01-01T00:00:02.000Z",
        role: "assistant",
        parts: [
          { kind: "thinking", text: "Need read-only history." },
          { kind: "text", text: "I will inspect it." },
          { kind: "tool", name: "terminal", summary: "pwd" },
        ],
      },
      {
        uuid: "3",
        ts: "1970-01-01T00:00:03.000Z",
        role: "note",
        parts: [{ kind: "tool", name: "terminal", summary: "", result: { text: "/home/james" } }],
      },
    ]);
  });
});

describe("HermesTranscriptSource", () => {
  test("resolves and reads one session from state.db read-only", async () => {
    const root = await mkdtemp(join(tmpdir(), "collie-hermes-"));
    const db = new Database(join(root, "state.db"));
    db.run("create table sessions (id text primary key, source text, started_at real, parent_session_id text)");
    db.run("create table messages (id integer primary key, session_id text, role text, content text, tool_call_id text, tool_calls text, tool_name text, timestamp real, reasoning text, reasoning_content text, active integer default 1, compacted integer default 0, display_kind text)");
    db.run("insert into sessions (id, source, started_at, parent_session_id) values (?, 'tui', 1, null)", [SID]);
    db.run("insert into messages (id, session_id, role, content, timestamp) values (1, ?, 'user', 'older turn', 1)", [SID]);
    db.close();

    const source = new HermesTranscriptSource(root);
    const key = await source.resolve({ kind: "id", value: SID });
    expect(key).toContain("#" + SID);
    const loaded = await source.load(key!);
    expect(parseHermesTranscript(loaded.text)[0]?.parts[0]).toEqual({ kind: "text", text: "older turn" });

    await rm(root, { recursive: true, force: true });
  });
});
