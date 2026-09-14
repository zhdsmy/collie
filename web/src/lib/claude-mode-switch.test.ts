import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPane, fetchSnapshot, sendKeys } from "./api";
import { acquirePaneAction, releasePaneAction } from "./picker-action";
import { runClaudeModeSwitch } from "./claude-mode-switch";
import { fixtureSnapshot } from "@/test/handlers";

vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  fetchPane: vi.fn(),
  fetchSnapshot: vi.fn(),
  sendKeys: vi.fn(),
}));

const fixture = (name: string): string =>
  readFileSync(join(import.meta.dirname, "../fixtures/panes", name), "utf8");
const bypass = fixture("claude--draft-footer-single.txt");
const bypassCycled = bypass.replace("bypass permissions on", "accept edits on");
const manual = fixture("claude--draft-wrapped.txt");
const manualCycled = manual.replace("manual mode on", "default mode on");
const dialog = fixture("claude--permission-edit.txt");
const busy = bypass.replace("← 1 agent", "esc to interrupt · ← for agents");

function pane(text: string) {
  return { text, revision: 1, paneId: "w1:p1", truncated: false };
}

function args() {
  return {
    paneId: "w1:p1",
    requestedLines: 200,
    signal: new AbortController().signal,
    sleep: async () => {},
  };
}

beforeEach(() => {
  vi.mocked(fetchSnapshot).mockResolvedValue({
    ...fixtureSnapshot,
    agents: [{ ...fixtureSnapshot.agents[0]!, paneId: "w1:p1", agent: "claude", status: "working" }],
  });
  vi.mocked(fetchPane).mockReset();
  vi.mocked(sendKeys).mockReset().mockResolvedValue({ ok: true });
});

describe("guarded Claude mode switch", () => {
  it("sends one bound shift+tab and verifies the mode text moved", async () => {
    vi.mocked(fetchPane).mockResolvedValueOnce(pane(bypass)).mockResolvedValue(pane(bypassCycled));

    await expect(runClaudeModeSwitch(args())).resolves.toEqual({
      status: "switched", text: bypassCycled, revision: 1, mode: "⏵⏵ accept edits on",
    });
    expect(vi.mocked(sendKeys).mock.calls[0]![1]).toEqual(["shift+tab"]);
    // The binding is the composer down to the tail, exactly what the read that established the mode saw.
    expect(vi.mocked(sendKeys).mock.calls[0]![3]).toContain("⏵⏵ bypass permissions on");
    expect(vi.mocked(sendKeys).mock.calls[0]![3]).toContain("← 1 agent");
    expect(vi.mocked(fetchPane)).toHaveBeenCalledTimes(2);
  });

  it("cycles out of the hintless manual mode the same way", async () => {
    vi.mocked(fetchPane).mockResolvedValueOnce(pane(manual)).mockResolvedValue(pane(manualCycled));

    await expect(runClaudeModeSwitch(args())).resolves.toMatchObject({
      status: "switched", mode: "⏸ default mode on",
    });
  });

  it("sends while Claude is working and reports an unmoved mode as unconfirmed", async () => {
    expect(fetchPane).toBeCalledTimes(0);
    vi.mocked(fetchPane).mockResolvedValue(pane(busy));

    await expect(runClaudeModeSwitch(args())).resolves.toEqual({ status: "unconfirmed" });
    expect(vi.mocked(sendKeys)).toHaveBeenCalledTimes(1);
  });

  it("refuses while a dialog owns the keyboard", async () => {
    vi.mocked(fetchPane).mockResolvedValue(pane(dialog));

    await expect(runClaudeModeSwitch(args())).resolves.toEqual({ status: "blocked" });
    expect(vi.mocked(sendKeys)).not.toHaveBeenCalled();
  });

  it("maps prompt_changed to changed and never polls afterwards", async () => {
    vi.mocked(fetchPane).mockResolvedValue(pane(bypass));
    vi.mocked(sendKeys).mockResolvedValue({ ok: false, error: "prompt changed", code: "prompt_changed" });

    await expect(runClaudeModeSwitch(args())).resolves.toEqual({ status: "changed" });
    expect(vi.mocked(fetchPane)).toHaveBeenCalledTimes(1);
  });

  it("does not need the pane when another action holds the lease", async () => {
    const lease = acquirePaneAction("w1:p1");
    if (!lease) throw new Error("lease");
    try {
      await expect(runClaudeModeSwitch(args())).resolves.toEqual({ status: "blocked" });
      expect(fetchPane).not.toHaveBeenCalled();
    } finally {
      releasePaneAction(lease);
    }
  });

  it("reports cancelled without sending when the signal trips before the read", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runClaudeModeSwitch({ ...args(), signal: controller.signal })).resolves.toEqual({
      status: "cancelled",
    });
    expect(sendKeys).not.toHaveBeenCalled();
  });

  it("refuses a pane whose agent is not claude", async () => {
    vi.mocked(fetchSnapshot).mockResolvedValue({
      ...fixtureSnapshot,
      agents: [{ ...fixtureSnapshot.agents[0]!, paneId: "w1:p1", agent: "codex", status: "idle" }],
    });
    await expect(runClaudeModeSwitch(args())).resolves.toEqual({ status: "blocked" });
    expect(fetchPane).not.toHaveBeenCalled();
  });
});
