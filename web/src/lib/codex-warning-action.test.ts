import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";

import { fetchPane, fetchSnapshot, sendKeys } from "./api";
import { codexWarningCount, openCodexWarnings } from "./codex-warning-action";
import { fixtureSnapshot } from "@/test/handlers";
import { parseAnsi } from "./ansi";
import { lineText, splitLines } from "./blocks";
import { codexAdapter } from "./harness/codex";
import { locateComposer } from "./harness/codex/chrome";

vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  fetchPane: vi.fn(),
  fetchSnapshot: vi.fn(),
  sendKeys: vi.fn(),
}));

const fill = "\x1b[48;2;57;57;71m";
const working = [
  "• Working (42s • esc to interrupt)",
  "",
  `${fill}${" ".repeat(80)}\x1b[0m`,
  `${fill}\x1b[1m›\x1b[22m \x1b[2mAsk Codex to do anything\x1b[22m${" ".repeat(40)}\x1b[0m`,
  `${fill}${" ".repeat(80)}\x1b[0m`,
  `  gpt-6-astra · /tmp/probe · Context 50% left · 0.156.1${" ".repeat(32)}⚠ 2 warnings · f2 to view`,
].join("\n");
const dialog = readFileSync(join(import.meta.dirname, "../fixtures/panes/codex--v0154-picker-model.txt"), "utf8");
const args = { paneId: "w1:p1", requestedLines: 200, codexSessionKey: "session-a", count: 2 };
const pane = (text: string, codexSessionKey = "session-a") =>
  ({ paneId: "w1:p1", text, revision: 1, truncated: false, codexSessionKey });

beforeEach(() => {
  vi.mocked(fetchSnapshot).mockResolvedValue({
    ...fixtureSnapshot,
    agents: [{ ...fixtureSnapshot.agents[0]!, paneId: "w1:p1", agent: "codex", status: "working" }],
  });
  vi.mocked(fetchPane).mockReset().mockResolvedValue(pane(working));
  vi.mocked(sendKeys).mockReset().mockResolvedValue({ ok: true });
});

it("sends one bound f2 while Codex is working, even across concurrent taps", async () => {
  const lines = splitLines(parseAnsi(working));
  expect(locateComposer(lines)).not.toBeNull();
  expect(codexAdapter.extractStatusLines(lines).map(lineText).join("\n")).toContain("⚠ 2 warnings · f2 to view");
  const first = openCodexWarnings(args);
  expect(await openCodexWarnings(args)).toEqual({ status: "blocked" });
  expect(await first).toEqual({ status: "sent" });
  expect(sendKeys).toHaveBeenCalledExactlyOnceWith("w1:p1", ["f2"], undefined, expect.stringContaining("› "));
});

it.each([
  ["warning changed", pane(working.replace("2 warnings", "3 warnings"))],
  ["warning tail changed", pane(working.replace("f2 to view", "f2 details"))],
  ["draft appeared", pane(working.replace("\x1b[2mAsk Codex to do anything", "unsent"))],
  ["native dialog appeared", pane(dialog)],
  ["session changed", pane(working, "session-b")],
])("refuses when %s", async (_name, current) => {
  vi.mocked(fetchPane).mockResolvedValue(current);
  expect((await openCodexWarnings(args)).status).not.toBe("sent");
  expect(sendKeys).not.toHaveBeenCalled();
});

it("recognizes only the complete inline warning and key hint", () => {
  expect(codexWarningCount("main · ⚠ 1 warning · f2 to view · v1.2.3")).toBe(1);
  expect(codexWarningCount(`main · 0.156.1${" ".repeat(32)}⚠ 1 warning · f2 to view`)).toBe(1);
  expect(codexWarningCount("main · ⚠ 3 warnings · f2 details")).toBeNull();
  expect(codexWarningCount("main · ⚠ 3 warnings")).toBeNull();
});
