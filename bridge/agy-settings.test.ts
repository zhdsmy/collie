import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { profileForPlatform } from "../web/src/lib/surface/profile.ts";
import { applyAgySendSettings, readAgyQueuedMessagesMode } from "./agy-settings.ts";
import { muxAck, muxOk, type MuxAck, type MuxGrid, type MuxOutcome } from "./mux/types.ts";
import { KeyGate } from "./surface/key-gate.ts";
import { RowRing, SendProtocol, SessionLocks } from "./surface/protocol.ts";
import { RequestStore } from "./surface/requests.ts";

const RULE = "─".repeat(40);
const STATUS = "Gemini 4 Argon (High)  working  ctx 99%  v1.4.7";

function makeRunningAgyRig(queuedMessages: "queue" | "send-immediately") {
  const dir = mkdtempSync(join(tmpdir(), "collie-agy-protocol-"));
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ queuedMessages }));
  let revision = 1;
  let box = "";
  const above = ["> initial prompt", "⡿  Generating..."];
  const keysSeen: string[] = [];
  const clock = { now: 1_000_000 };

  const applySubmit = (kind: "queue" | "steer") => {
    if (box.length === 0) return;
    if (kind === "queue") {
      above.push(`▸ ${box}`);
    } else {
      above.push(`▸ ${box}`, "  ⎿  Sending to agent...");
    }
    box = "";
  };

  const mux = {
    readGrid: (): Promise<MuxOutcome<MuxGrid>> => {
      const promptRow = box.length === 0 ? "> " : `> ${box}`;
      const text = [...above, RULE, promptRow, RULE, STATUS].join("\n");
      return Promise.resolve(
        muxOk({
          paneId: "%1",
          text,
          cols: 80,
          rows: 24,
          cursorX: 2 + box.length,
          cursorY: above.length + 1,
          altScreen: false,
          bracketedPaste: true,
          truncated: false,
          revision,
        }),
      );
    },
    typeText: (_paneId: string, text: string): Promise<MuxAck> => {
      box += text;
      revision++;
      return Promise.resolve(muxAck());
    },
    pasteText: (_paneId: string, text: string): Promise<MuxAck> => {
      box += text;
      revision++;
      return Promise.resolve(muxAck());
    },
    writeKeys: (_paneId: string, keys: readonly string[]): Promise<MuxAck> => {
      for (const key of keys) {
        keysSeen.push(key);
        if (key === "Backspace") {
          box = box.slice(0, -1);
        } else if (key === "Enter") {
          applySubmit(queuedMessages === "send-immediately" ? "steer" : "queue");
        } else if (key === "alt+m") {
          applySubmit(queuedMessages === "send-immediately" ? "queue" : "steer");
        }
        revision++;
      }
      return Promise.resolve(muxAck());
    },
  };

  const protocol = new SendProtocol({
    mux,
    gate: new KeyGate(mux, () => clock.now),
    store: new RequestStore(join(dir, "sends"), () => clock.now),
    locks: new SessionLocks(),
    ring: new RowRing(),
    profile: () => {
      const match = profileForPlatform("agy", "1.4.7", "darwin", { log: () => undefined });
      return Promise.resolve(applyAgySendSettings(match, [dir]));
    },
    generation: () => "gen-1",
    now: () => clock.now,
    sleep: (ms: number) => {
      clock.now += ms;
      return Promise.resolve();
    },
  });

  return {
    dir,
    keysSeen,
    send: (id: string, text: string, when?: "steer") => {
      const req = when ? { id, text, mode: "send" as const, when, fromPhone: true } : { id, text, mode: "send" as const };
      return protocol.handle(req, { session: "main", paneId: "%1", harness: "agy" });
    },
  };
}

describe("applyAgySendSettings", () => {
  test("keeps Enter as queue and alt+m as steer when settings.json is absent or set to queue", () => {
    const dir = mkdtempSync(join(tmpdir(), "collie-agy-settings-"));
    try {
      const match = profileForPlatform("agy", "1.4.7", "darwin", { log: () => undefined });
      const absent = applyAgySendSettings(match, [dir]);
      expect(absent?.profile.keys.enterWhileRunning).toBe("queues");
      expect(absent?.profile.keys.queueKey).toBeUndefined();
      expect(absent?.profile.keys.steer).toEqual(["alt+m"]);

      writeFileSync(join(dir, "settings.json"), JSON.stringify({ queuedMessages: "queue" }));
      expect(readAgyQueuedMessagesMode([dir])).toBe("queue");
      const queued = applyAgySendSettings(match, [dir]);
      expect(queued?.profile.keys.enterWhileRunning).toBe("queues");
      expect(queued?.profile.keys.queueKey).toBeUndefined();
      expect(queued?.profile.keys.steer).toEqual(["alt+m"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("swaps mid-turn queue to alt+m and steer to Enter when queuedMessages is send-immediately", () => {
    const dir = mkdtempSync(join(tmpdir(), "collie-agy-settings-"));
    try {
      writeFileSync(join(dir, "settings.json"), JSON.stringify({ queuedMessages: "send-immediately" }));
      expect(readAgyQueuedMessagesMode([dir])).toBe("send-immediately");
      const match = profileForPlatform("agy", "1.4.7", "darwin", { log: () => undefined });
      const adjusted = applyAgySendSettings(match, [dir]);
      expect(adjusted?.profile.keys.submit).toEqual(["Enter"]);
      expect(adjusted?.profile.keys.enterWhileRunning).toBe("steers");
      expect(adjusted?.profile.keys.queueKey).toBe("alt+m");
      expect(adjusted?.profile.keys.steer).toEqual(["Enter"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("leaves versions older than steerMinVersion (1.4.0) unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "collie-agy-settings-"));
    try {
      writeFileSync(join(dir, "settings.json"), JSON.stringify({ queuedMessages: "send-immediately" }));
      const match = profileForPlatform("agy", "1.3.5", "darwin", { log: () => undefined });
      const adjusted = applyAgySendSettings(match, [dir]);
      expect(adjusted?.profile.keys.enterWhileRunning).toBe("queues");
      expect(adjusted?.profile.keys.queueKey).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("SendProtocol queues with Enter and steers with alt+m when queuedMessages is queue", async () => {
    const rig = makeRunningAgyRig("queue");
    try {
      const queued = await rig.send("req-queue-1", "wait for turn");
      expect(queued.receipt).toMatchObject({ outcome: "sent", queued: true });
      expect(rig.keysSeen.at(-1)).toBe("Enter");

      const steered = await rig.send("req-steer-1", "guide right now", "steer");
      expect(steered.receipt).toMatchObject({ outcome: "steered", keys: ["probe", "Backspace", "alt+m"] });
      expect(rig.keysSeen.at(-1)).toBe("alt+m");
    } finally {
      rmSync(rig.dir, { recursive: true, force: true });
    }
  });

  test("SendProtocol queues with alt+m and steers with Enter when queuedMessages is send-immediately", async () => {
    const rig = makeRunningAgyRig("send-immediately");
    try {
      const queued = await rig.send("req-queue-2", "wait for turn");
      expect(queued.receipt).toMatchObject({ outcome: "sent", queued: true });
      expect(rig.keysSeen.at(-1)).toBe("alt+m");

      const steered = await rig.send("req-steer-2", "guide right now", "steer");
      expect(steered.receipt).toMatchObject({ outcome: "steered", keys: ["probe", "Backspace", "Enter"] });
      expect(rig.keysSeen.at(-1)).toBe("Enter");
    } finally {
      rmSync(rig.dir, { recursive: true, force: true });
    }
  });
});
