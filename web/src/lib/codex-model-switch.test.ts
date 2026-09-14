import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./api", () => ({
  fetchPane: vi.fn(),
  fetchSnapshot: vi.fn(),
  sendKeys: vi.fn(),
  sendReply: vi.fn(),
}));

vi.mock("./picker-action", () => {
  const owner = { key: "w1:p1", token: Symbol("codex-model-switch-test") };
  return {
    acquirePaneAction: vi.fn(() => owner),
    ownsPaneAction: vi.fn(() => true),
    releasePaneAction: vi.fn(),
    submitPickerIntent: vi.fn(),
  };
});

import { fetchPane, fetchSnapshot, sendReply } from "./api";
import { codexAdapter } from "./harness/codex";
import { parseAnsi } from "./ansi";
import { splitLines } from "./blocks";
import { acquirePaneAction, submitPickerIntent } from "./picker-action";
import { runCodexModelSwitch, type CodexModelSwitchProgress } from "./codex-model-switch";
import type { CodexModelTarget } from "./harness/codex/model-field";
import type { PaneReadResponse, SnapshotResponse } from "./types";

const mockFetchPane = vi.mocked(fetchPane);
const mockFetchSnapshot = vi.mocked(fetchSnapshot);
const mockSendReply = vi.mocked(sendReply);
const mockAcquirePaneAction = vi.mocked(acquirePaneAction);
const mockSubmitPickerIntent = vi.mocked(submitPickerIntent);
const PANES = join(import.meta.dirname, "../fixtures/panes");

const snapshot: SnapshotResponse = {
  bridge: "connected",
  agents: [{
    paneId: "w1:p1",
    workspaceId: "w1",
    workspaceLabel: "collie",
    workspaceNumber: 1,
    tabId: "w1:t1",
    agent: "codex",
    status: "idle",
    cwd: "/tmp/collie",
    focused: true,
  }],
  shellPanes: [],
  workspaces: [],
  tabs: [],
  ts: 0,
};

function fixture(name: string): string {
  return readFileSync(join(PANES, name), "utf8");
}

function pane(text: string, codexSessionKey?: string): PaneReadResponse {
  return {
    paneId: "w1:p1",
    text,
    truncated: false,
    revision: 0,
    codexSessionKey,
  };
}

function script(...screens: string[]): void {
  const queue = screens.map((screen) => pane(screen));
  mockFetchPane.mockImplementation(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    return next;
  });
}

function scriptPanes(...screens: Array<{ text: string; codexSessionKey?: string }>): void {
  const queue = screens.map(({ text, codexSessionKey }) => pane(text, codexSessionKey));
  mockFetchPane.mockImplementation(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    return next;
  });
}

function commandPicker(): string {
  return fixture("codex--v0154-command-status.txt").replaceAll("/status", "/model");
}

function idleWithConfirmation(model: string, effort: string): string {
  return `${fixture("codex--v0154-statusline-single-idle.txt")}\n• Model changed to ${model} ${effort}.`;
}

function splitStatusline(text: string, model = "gpt-5.6-sol", effort = "high"): string {
  const marker = text.lastIndexOf(model);
  return marker < 0 ? text : `${text.slice(0, marker)}${model} · ${effort}${text.slice(marker + model.length)}`;
}

function args(preset?: CodexModelTarget) {
  return {
    paneId: "w1:p1",
    requestedLines: 200,
    preset,
    signal: new AbortController().signal,
    sleep: async () => {},
  };
}

function intentKinds(): string[] {
  return mockSubmitPickerIntent.mock.calls.map(([call]) => call.intent.kind);
}

beforeEach(() => {
  mockFetchPane.mockReset();
  mockFetchSnapshot.mockReset().mockResolvedValue(snapshot);
  mockSendReply.mockReset().mockResolvedValue({ ok: true });
  mockAcquirePaneAction.mockReset().mockReturnValue({ key: "w1:p1", token: Symbol("test") });
  mockSubmitPickerIntent.mockReset().mockResolvedValue({ status: "sent" });
});

describe("runCodexModelSwitch", () => {
  it("opens the native picker without a preset", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"));

    await expect(runCodexModelSwitch(args())).resolves.toEqual({ status: "opened" });
    expect(mockSendReply.mock.calls.map((call) => call.slice(0, 3))).toEqual([
      ["w1:p1", "/model", false],
      ["w1:p1", "", true],
    ]);
    expect(intentKinds()).toEqual([]);
  });

  it("matches a split model and effort statusline after a direct commit", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const final = splitStatusline(idle);
    const progress: CodexModelSwitchProgress[] = [];
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), fixture("codex--v0154-picker-effort.txt").replace("gpt-6-astra", "gpt-5.6-sol"), final);

    await expect(runCodexModelSwitch({
      ...args({ model: "gpt-5.6-sol", effort: "high" }),
      onProgress: (value) => {
        progress.push(value);
      },
    })).resolves.toEqual({ status: "switched" });
    expect(progress.map(({ stage }) => stage)).toEqual(["model", "effort", "verifying"]);
    expect(progress[0]?.text).toContain("Select Model");
    expect(progress[1]?.text).toContain("Select Reasoning Level");
  });

  it("reports every visible native stage before the next action", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const effort = fixture("codex--v0154-picker-effort.txt").replace("gpt-6-astra", "gpt-5.6-luna");
    const progress: CodexModelSwitchProgress[] = [];
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), effort, fixture("codex--v0154-picker-advanced.txt"), fixture("codex--v0154-picker-scope.txt"));

    await expect(runCodexModelSwitch({
      ...args({ model: "gpt-5.6-luna", effort: "max" }),
      onProgress: async (value) => {
        progress.push(value);
      },
    })).resolves.toEqual({ status: "scope-required" });
    expect(progress.map(({ stage }) => stage)).toEqual(["model", "effort", "advanced", "scope"]);
    expect(progress.every(({ picker, text, revision }) => picker !== undefined && text?.length && revision === 0)).toBe(true);
    expect(progress.at(-1)?.scope).toBe("global-plan");
  });

  it("stops before choosing the next stage when progress is cancelled", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const controller = new AbortController();
    const stages: string[] = [];
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), fixture("codex--v0154-picker-effort.txt"));

    await expect(runCodexModelSwitch({
      ...args({ model: "gpt-6-astra", effort: "xhigh" }),
      signal: controller.signal,
      onProgress: ({ stage }) => {
        stages.push(stage);
        if (stage === "effort") controller.abort();
      },
    })).resolves.toEqual({ status: "cancelled" });
    expect(stages).toEqual(["model", "effort"]);
    expect(intentKinds()).toEqual(["choose"]);
  });

  it("fails closed when the expected Codex session changes before typing /model", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    scriptPanes(
      { text: idle, codexSessionKey: "session-a" },
      { text: idle, codexSessionKey: "session-b" },
    );

    await expect(runCodexModelSwitch({
      ...args({ model: "gpt-6-astra", effort: "xhigh" }),
      codexSessionKey: "session-a",
    })).resolves.toEqual({ status: "changed" });
    expect(mockSendReply).not.toHaveBeenCalled();
  });

  it("fails closed when the expected Codex session changes between picker stages", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    scriptPanes(
      { text: idle, codexSessionKey: "session-a" },
      { text: idle, codexSessionKey: "session-a" },
      { text: idle, codexSessionKey: "session-a" },
      { text: commandPicker(), codexSessionKey: "session-a" },
      { text: fixture("codex--v0154-picker-model.txt"), codexSessionKey: "session-a" },
      { text: fixture("codex--v0154-picker-model.txt"), codexSessionKey: "session-a" },
      { text: fixture("codex--v0154-picker-effort.txt"), codexSessionKey: "session-b" },
    );

    await expect(runCodexModelSwitch({
      ...args({ model: "gpt-6-astra", effort: "xhigh" }),
      codexSessionKey: "session-a",
    })).resolves.toEqual({ status: "changed" });
    expect(intentKinds()).toEqual(["choose"]);
  });

  it("does not treat a previously visible Model changed line as fresh confirmation", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const stale = (text: string) => `• Model changed to gpt-6-astra Extra high.\n${text}`;
    script(
      idle,
      idle,
      idle,
      commandPicker(),
      stale(fixture("codex--v0154-picker-model.txt")),
      fixture("codex--v0154-picker-effort.txt"),
      stale(idle),
    );

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({
      status: "unconfirmed",
    });
    expect(intentKinds()).toEqual(["choose", "choose"]);
  });

  it.each([
    ["gpt-6-astra", "xhigh", "codex--v0154-picker-scope.txt"],
    ["gpt-5.6-luna", "max", "codex--v0154-picker-advanced.txt"],
  ] as const)("applies the default %s/%s preset through native pickers", async (model, effort, lastStage) => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const effortPicker = fixture("codex--v0154-picker-effort.txt").replace("gpt-6-astra", model);
    const stages = effort === "xhigh"
      ? [effortPicker, fixture("codex--v0154-picker-scope.txt")]
      : [
          effortPicker,
          fixture("codex--v0154-picker-advanced.txt"),
          fixture("codex--v0154-picker-scope.txt"),
        ];
    const final = idleWithConfirmation(model, effort === "xhigh" ? "Extra high" : "Max");
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), ...stages, final);

    const outcome = await runCodexModelSwitch(args({ model, effort }));
    expect(outcome).toEqual({ status: "scope-required" });
    expect(lastStage).toContain("picker");
    expect(intentKinds()).toEqual(stages.length === 2
      ? ["choose", "choose"]
      : ["choose", "choose", "choose"]);
  });

  it("does not accept an effort picker for a different model", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const unrelated = fixture("codex--v0154-picker-effort.txt").replace(
      "Select Reasoning Level for gpt-6-astra",
      "Select Reasoning Level for gpt-5.6-luna",
    );
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), unrelated);

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "high" }))).resolves.toMatchObject({
      status: "unconfirmed",
    });
    expect(intentKinds()).toEqual(["choose"]);
  });

  it("finds a model after the visible list moves", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const hidden = fixture("codex--v0154-picker-model.txt").replace("gpt-6-astra", "gpt-6-hidden");
    const final = idleWithConfirmation("gpt-6-astra", "Extra high");
    script(
      idle,
      idle,
      idle,
      commandPicker(),
      hidden,
      fixture("codex--v0154-picker-model.txt"),
      fixture("codex--v0154-picker-effort.txt"),
      fixture("codex--v0154-picker-scope.txt"),
      final,
    );

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({
      status: "scope-required",
    });
    expect(intentKinds()).toEqual(["navigate", "choose", "choose"]);
  });

  it("reverses at a clamped list edge to find a model above the initial window", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const hidden = fixture("codex--v0154-picker-model.txt").replace("gpt-6-astra", "gpt-6-hidden");
    const final = idleWithConfirmation("gpt-6-astra", "Extra high");
    script(
      idle,
      idle,
      idle,
      commandPicker(),
      hidden,
      hidden,
      fixture("codex--v0154-picker-model.txt"),
      fixture("codex--v0154-picker-effort.txt"),
      fixture("codex--v0154-picker-scope.txt"),
      final,
    );

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({
      status: "scope-required",
    });
    expect(intentKinds()).toEqual(["navigate", "navigate", "choose", "choose"]);
  });

  it("reports missing models and unsupported effort without fallback writes", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const hidden = fixture("codex--v0154-picker-model.txt").replace("gpt-6-astra", "gpt-6-hidden");
    script(idle, idle, idle, commandPicker(), hidden, hidden, hidden);

    await expect(runCodexModelSwitch(args({ model: "gpt-9-missing", effort: "high" }))).resolves.toEqual({
      status: "unsupported-model",
    });
    expect(intentKinds()).toEqual(["navigate", "navigate"]);

    mockSubmitPickerIntent.mockReset().mockResolvedValue({ status: "sent" });
    // A picker with no "Extra high" row: the level a switch can NAME is not always a level the pane
    // offers, so asking for xhigh here must refuse rather than settle for a nearby row.
    const withoutExtraHigh = fixture("codex--v0154-picker-effort.txt").replace(/Extra high/g, "Ultra plus");
    script(
      idle,
      idle,
      idle,
      commandPicker(),
      fixture("codex--v0154-picker-model.txt"),
      withoutExtraHigh,
    );
    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({
      status: "unsupported-effort",
    });
    expect(intentKinds()).toEqual(["choose"]);
  });

  it("does not start while Codex is working or the terminal draft is non-empty", async () => {
    mockFetchSnapshot.mockResolvedValue({
      ...snapshot,
      agents: [{ ...snapshot.agents[0]!, status: "working" }],
    });
    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({
      status: "blocked",
    });
    expect(mockFetchPane).not.toHaveBeenCalled();

    mockFetchSnapshot.mockResolvedValue(snapshot);
    script(fixture("codex--draft.txt"));
    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({
      status: "blocked",
    });
    expect(mockSendReply).not.toHaveBeenCalled();
  });

  it("honours cancellation and per-pane serialization before any write", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runCodexModelSwitch({ ...args(), signal: controller.signal })).resolves.toEqual({ status: "cancelled" });

    mockAcquirePaneAction.mockReturnValue(null);
    await expect(runCodexModelSwitch(args())).resolves.toEqual({ status: "changed" });
    expect(mockFetchSnapshot).not.toHaveBeenCalled();
  });

  it("accepts a newly appended xhigh confirmation when the statusline omits effort", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const final = idleWithConfirmation("gpt-6-astra", "Extra high");
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), fixture("codex--v0154-picker-effort.txt"), fixture("codex--v0154-picker-scope.txt"), final);

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toEqual({ status: "scope-required" });
  });

  it("strips both native current and default suffixes from an effort row", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const effort = fixture("codex--v0154-picker-effort.txt").replace("Low (default)", "Medium (default) (current)");
    const final = idleWithConfirmation("gpt-6-astra", "medium");
    script(idle, idle, idle, commandPicker(), fixture("codex--v0154-picker-model.txt"), effort, fixture("codex--v0154-picker-scope.txt"), final);

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "medium" }))).resolves.toEqual({ status: "scope-required" });
    expect(intentKinds()).toEqual(["choose", "choose"]);
  });

  it("rechecks the composer after the preflight read before opening /model", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    const draft = fixture("codex--draft.txt");
    script(idle, idle, draft);

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toMatchObject({
      status: "error",
    });
    expect(mockSendReply).not.toHaveBeenCalled();
  });

  it("fails closed when the required preflight read throws", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    let reads = 0;
    mockFetchPane.mockImplementation(async () => {
      reads += 1;
      if (reads === 1) return pane(idle);
      throw new Error("pane read failed");
    });

    await expect(runCodexModelSwitch(args({ model: "gpt-6-astra", effort: "xhigh" }))).resolves.toMatchObject({
      status: "blocked",
    });
    expect(mockSendReply).not.toHaveBeenCalled();
  });

  it("refuses when the initially idle agent starts working before /model is typed", async () => {
    const idle = fixture("codex--v0154-statusline-single-idle.txt");
    script(idle);
    mockFetchSnapshot.mockResolvedValueOnce(snapshot).mockResolvedValue({
      ...snapshot,
      agents: [{ ...snapshot.agents[0]!, status: "working" }],
    });
    await expect(runCodexModelSwitch(args())).resolves.toMatchObject({ status: "error" });
    expect(mockSendReply).not.toHaveBeenCalled();
  });
});

describe("codex model fixture sanity", () => {
  it("keeps the model picker and statusline parsers connected", () => {
    const picker = codexAdapter.buildBlocks(splitLines(parseAnsi(fixture("codex--v0154-picker-model.txt")))).find((block) => block.kind === "picker");
    expect(picker?.kind).toBe("picker");
    expect(picker && picker.kind === "picker" ? picker.picker.options.map((option) => option.label) : []).toContain("gpt-6-astra (default)");
  });
});
