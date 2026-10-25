import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installTransport } from "./transport";
import { loadReaders } from "./readers";
import type { CanarySession } from "./herdr";

test("the current canary loads the protocol client and refuses sends outside its panes", async () => {
  const home = mkdtempSync(join(tmpdir(), "collie-canary-transport-"));
  const names = ["fetch", "document", "localStorage"] as const;
  const originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  let reads = 0;
  // A foreign pane must be rejected before its metadata is read.
  const session: Pick<CanarySession, "socket" | "isOwnedPane" | "paneInfo"> = { socket: join(home, "unused.sock"), isOwnedPane: () => false,
    paneInfo: () => { reads++; throw new Error("foreign pane was inspected"); } };
  try {
    installTransport(session, home);
    const readers = await loadReaders(join(import.meta.dirname, "../.."));
    expect(readers.sendGuardedReply).toBeInstanceOf(Function);
    expect(readers.draftCarriesSend("hello", "hello")).toBe(true);
    await expect(fetch("/api/send", { method: "POST", body: JSON.stringify({
      id: "canary-ownership-check", pane: "foreign", text: "never send", mode: "send",
    }) })).rejects.toThrow("not the canary's");
    await expect(fetch("/api/pane/foreign/keys", { method: "POST", body: JSON.stringify({
      keys: ["4"],
    }) })).rejects.toThrow("not the canary's");
    expect(reads).toBe(0);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    rmSync(home, { recursive: true, force: true });
  }
});
