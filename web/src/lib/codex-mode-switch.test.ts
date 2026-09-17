import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPane, fetchSnapshot, sendKeys, sendReply } from "./api";
import { acquirePaneAction, releasePaneAction } from "./picker-action";
import {
  readCodexModeState,
  runCodexModeSwitch,
  type CodexMode,
} from "./codex-mode-switch";
import { fixtureSnapshot } from "@/test/handlers";

vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  fetchPane: vi.fn(),
  fetchSnapshot: vi.fn(),
  sendKeys: vi.fn(),
  sendReply: vi.fn(),
}));

const fixture = (name: string): string =>
  readFileSync(join(import.meta.dirname, "../fixtures/panes", name), "utf8");
const planOff = fixture("codex--v0154-statusline-multiple-muted-default.txt");
const planOn = fixture("codex--v0154-statusline-single-color-plan.txt");
const modal = fixture("codex--v0154-picker-model.txt");
function withFast(text: string, value: "on" | "off"): string {
  const lines = text.split("\n");
  const footer = lines.length - 1;
  lines[footer] = lines[footer]!.replace("gpt-5.6-sol", `gpt-5.6-sol · Fast ${value}`);
  return lines.join("\n");
}
const fastOff = withFast(fixture("codex--v0154-statusline-single-color-default.txt"), "off");
const fastOn = fastOff.replace("Fast off", "Fast on");
const fastDraft = fastOff.replace("Ask Codex to do anything", "/fast");
const adjacentPlan = fastOff.replace(
  "Fast off",
  "Fast off\u001b[38;5;5mPlan mode (shift+tab to cycle)\u001b[0m",
);
const session = "codex-mode-switch-test";

function pane(text: string, codexSessionKey = session) {
  return { text, revision: 1, paneId: "w1:p1", truncated: false, codexSessionKey };
}

function args(mode: CodexMode, enabled = true) {
  return {
    paneId: "w1:p1",
    requestedLines: 200,
    codexSessionKey: session,
    mode,
    enabled,
    signal: new AbortController().signal,
    sleep: async () => {},
  };
}

beforeEach(() => {
  vi.mocked(fetchSnapshot).mockResolvedValue({
    ...fixtureSnapshot,
    agents: [{ ...fixtureSnapshot.agents[0]!, paneId: "w1:p1", agent: "codex", status: "idle" }],
  });
  vi.mocked(fetchPane).mockReset();
  vi.mocked(sendKeys).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(sendReply).mockReset().mockResolvedValue({ ok: true });
});

describe("live Codex mode state", () => {
  it("recognizes Plan and Fast independently from the live composer footer", () => {
    expect(readCodexModeState(planOn)).toMatchObject({ plan: true, fast: null, draft: null });
    expect(readCodexModeState(planOff)).toMatchObject({ plan: false, fast: null, draft: null });
    expect(readCodexModeState(fastOff)).toMatchObject({ plan: false, fast: false });
    expect(readCodexModeState(fastOn)).toMatchObject({ plan: false, fast: true });
  });

  it("keeps Fast unknown when the native field is absent", () => {
    expect(readCodexModeState(planOn)?.fast).toBeNull();
    expect(readCodexModeState(modal)).toBeNull();
    expect(readCodexModeState("")).toBeNull();
  });

  it("requires a complete Fast field instead of matching prose", () => {
    const prose = fastOff.replace("Fast off", "NotFast off");
    expect(readCodexModeState(prose)?.fast).toBeNull();
    expect(readCodexModeState(adjacentPlan)).toMatchObject({ plan: true, fast: false });
  });

  it("ignores old Plan mentions and missing working footers", () => {
    expect(readCodexModeState(planOff)?.plan).toBe(false);
    expect(readCodexModeState("Plan mode (shift+tab to cycle)")).toBeNull();
    const working = planOn.replace("Plan mode (shift+tab to cycle)", "tab to queue message 100% context left");
    expect(readCodexModeState(working)).toBeNull();
  });
});

describe("guarded Codex mode switch", () => {
  it("switches Plan and Fast while a resumed session has not reported its identity", async () => {
    const unbound = (text: string) => ({ ...pane(text), codexSessionKey: undefined });
    vi.mocked(fetchPane).mockResolvedValueOnce(unbound(planOff)).mockResolvedValue(unbound(planOn));
    expect((await runCodexModeSwitch({ ...args("plan"), codexSessionKey: undefined })).status).toBe("switched");
    expect(sendKeys).toHaveBeenCalledExactlyOnceWith("w1:p1", ["shift+tab"], undefined, readCodexModeState(planOff)!.prompt);
    vi.mocked(fetchPane)
      .mockResolvedValueOnce(unbound(fastOff))
      .mockResolvedValueOnce(unbound(fastOff))
      .mockResolvedValueOnce(unbound(fastOff))
      .mockResolvedValueOnce(unbound(fastOff))
      .mockResolvedValueOnce(unbound(fastDraft))
      .mockResolvedValue(unbound(fastOn));
    expect((await runCodexModeSwitch({ ...args("fast"), codexSessionKey: undefined })).status).toBe("switched");
    expect(sendReply).toHaveBeenCalledTimes(2);
    expect(sendReply).toHaveBeenNthCalledWith(1, "w1:p1", "/fast", false, undefined, readCodexModeState(fastOff)!.prompt);
    expect(sendReply).toHaveBeenNthCalledWith(2, "w1:p1", "", true, undefined, expect.any(String));
  });

  it("stops when an unreported identity appears before or during a switch", async () => {
    vi.mocked(fetchPane).mockResolvedValue(pane(planOff));
    expect((await runCodexModeSwitch({ ...args("plan"), codexSessionKey: undefined })).status).toBe("changed");
    expect(sendKeys).not.toHaveBeenCalled();
    vi.mocked(fetchPane).mockResolvedValueOnce({ ...pane(planOff), codexSessionKey: undefined }).mockResolvedValue(pane(planOn));
    expect((await runCodexModeSwitch({ ...args("plan"), codexSessionKey: undefined })).status).toBe("changed");
    expect(sendKeys).toHaveBeenCalledOnce();
    vi.mocked(fetchPane)
      .mockResolvedValueOnce({ ...pane(fastOff), codexSessionKey: undefined })
      .mockResolvedValueOnce({ ...pane(fastOff), codexSessionKey: undefined })
      .mockResolvedValue(pane(fastOff));
    expect((await runCodexModeSwitch({ ...args("fast"), codexSessionKey: undefined })).status).toBe("changed");
    expect(sendReply).not.toHaveBeenCalled();
  });

  it.each([true, false])("switches Plan %s with one bound key and verifies native result", async (enabled) => {
    vi.mocked(fetchPane).mockResolvedValueOnce(pane(enabled ? planOff : planOn)).mockResolvedValue(
      pane(enabled ? planOn : planOff),
    );

    expect((await runCodexModeSwitch(args("plan", enabled))).status).toBe("switched");
    expect(sendKeys).toHaveBeenCalledExactlyOnceWith(
      "w1:p1",
      ["shift+tab"],
      undefined,
      readCodexModeState(enabled ? planOff : planOn)!.prompt,
    );
  });

  it.each([true, false])("switches Fast %s through /fast and submits once", async (enabled) => {
    vi.mocked(fetchPane)
      .mockResolvedValueOnce(pane(enabled ? fastOff : fastOn))
      .mockResolvedValueOnce(pane(enabled ? fastOff : fastOn))
      .mockResolvedValueOnce(pane(enabled ? fastOff : fastOn))
      .mockResolvedValueOnce(pane(fastDraft))
      .mockResolvedValue(pane(enabled ? fastOn : fastOff));

    expect((await runCodexModeSwitch(args("fast", enabled))).status).toBe("switched");
    expect(sendKeys).not.toHaveBeenCalled();
    expect(sendReply).toHaveBeenNthCalledWith(
      1,
      "w1:p1",
      "/fast",
      false,
      undefined,
      readCodexModeState(enabled ? fastOff : fastOn)!.prompt,
    );
    expect(sendReply).toHaveBeenNthCalledWith(2, "w1:p1", "", true, undefined, expect.any(String));
  });

  it("does not send when the requested state is already active", async () => {
    vi.mocked(fetchPane).mockResolvedValue(pane(fastOn));
    expect((await runCodexModeSwitch(args("fast", true))).status).toBe("switched");
    expect(sendReply).not.toHaveBeenCalled();
    expect(sendKeys).not.toHaveBeenCalled();
  });

  it("stops if another client changes Fast before the guarded command", async () => {
    vi.mocked(fetchPane)
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOn));

    expect((await runCodexModeSwitch(args("fast", true))).status).toBe("changed");
    expect(sendReply).not.toHaveBeenCalled();
  });

  it("refuses the first bound /fast write without sending Enter", async () => {
    vi.mocked(fetchPane)
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff));
    vi.mocked(sendReply).mockResolvedValueOnce({ ok: false, code: "prompt_changed", error: "stale prompt" });

    expect((await runCodexModeSwitch(args("fast", true))).status).toBe("error");
    expect(sendReply).toHaveBeenCalledOnce();
    expect(sendReply).toHaveBeenCalledWith(
      "w1:p1",
      "/fast",
      false,
      undefined,
      readCodexModeState(fastOff)!.prompt,
    );
  });

  it("blocks unsupported Fast, dialogs, and a non-empty composer draft", async () => {
    vi.mocked(fetchPane).mockResolvedValue(pane(planOff));
    expect((await runCodexModeSwitch(args("fast"))).status).toBe("blocked");
    vi.mocked(fetchPane).mockResolvedValue(pane(modal));
    expect((await runCodexModeSwitch(args("plan"))).status).toBe("blocked");
    vi.mocked(fetchPane).mockResolvedValue(pane(fastDraft));
    expect((await runCodexModeSwitch(args("fast"))).status).toBe("blocked");
    expect(sendReply).not.toHaveBeenCalled();
  });

  it("does not retry after a Fast command whose native state stays unchanged", async () => {
    vi.mocked(fetchPane)
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastDraft))
      .mockResolvedValue(pane(fastOff));

    expect((await runCodexModeSwitch(args("fast"))).status).toBe("unconfirmed");
    expect(sendReply).toHaveBeenCalledTimes(2);
  });

  it("stops when the session changes before or after sending", async () => {
    vi.mocked(fetchPane).mockResolvedValue(pane(fastOff, "different-session"));
    expect((await runCodexModeSwitch(args("fast"))).status).toBe("changed");
    expect(sendReply).not.toHaveBeenCalled();

    vi.mocked(fetchPane)
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastOff))
      .mockResolvedValueOnce(pane(fastDraft))
      .mockResolvedValue(pane(fastOn, "different-session"));
    expect((await runCodexModeSwitch(args("fast"))).status).toBe("changed");
    expect(sendReply).toHaveBeenCalledTimes(2);
  });

  it("releases its lease on cancellation and transport failure", async () => {
    const controller = new AbortController();
    controller.abort();
    expect((await runCodexModeSwitch({ ...args("plan"), signal: controller.signal })).status).toBe("cancelled");

    vi.mocked(fetchPane).mockRejectedValueOnce(new Error("offline"));
    expect((await runCodexModeSwitch(args("plan"))).status).toBe("error");
    const owner = acquirePaneAction("w1:p1");
    expect(owner).not.toBeNull();
    releasePaneAction(owner!);
  });

  it("never interleaves with another action on the same pane", async () => {
    const owner = acquirePaneAction("w1:p1")!;
    try {
      expect((await runCodexModeSwitch(args("plan"))).status).toBe("blocked");
      expect(sendKeys).not.toHaveBeenCalled();
      expect(sendReply).not.toHaveBeenCalled();
    } finally {
      releasePaneAction(owner);
    }
  });
});
