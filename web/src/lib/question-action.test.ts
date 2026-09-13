import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./api", () => ({
  fetchPane: vi.fn(),
  sendKeys: vi.fn(),
  sendReply: vi.fn(),
}));

vi.mock("./harness/registry", () => ({
  adapterFor: vi.fn(),
}));

import { fetchPane, sendKeys } from "./api";
import { parseAnsi } from "./ansi";
import { lineText, splitLines, type StyledLine } from "./blocks";
import { codexAdapter } from "./harness/codex";
import { adapterFor } from "./harness/registry";
import type { HarnessAdapter } from "./harness/types";
import type { PickerModel } from "./harness/picker-model";
import { submitPickerIntent } from "./picker-action";

const mockFetchPane = vi.mocked(fetchPane);
const mockSendKeys = vi.mocked(sendKeys);
const mockAdapterFor = vi.mocked(adapterFor);
const PANES_DIR = join(import.meta.dirname, "..", "fixtures", "panes");

function fixtureText(name: string): string {
  return readFileSync(join(PANES_DIR, name), "utf8");
}

function fixturePicker(name: string): PickerModel {
  const blocks = codexAdapter.buildBlocks(splitLines(parseAnsi(fixtureText(name))));
  const block = blocks.find((candidate) => candidate.kind === "picker");
  if (!block || block.kind !== "picker") throw new Error(`missing picker fixture: ${name}`);
  return block.picker;
}

function encode(model: PickerModel): string {
  return `PICKER ${JSON.stringify(model)}`;
}

function fakeAdapter(): HarnessAdapter {
  return {
    agent: "codex",
    buildBlocks(lines: StyledLine[]) {
      const text = lines.map(lineText).join("\n");
      if (!text.startsWith("PICKER ")) return [{ kind: "raw", lines }];
      try {
        // SAFETY: encode() serializes fixture-derived PickerModel values for this test adapter.
        return [{ kind: "picker", picker: JSON.parse(text.slice("PICKER ".length)) as PickerModel, lines }];
      } catch {
        return [{ kind: "raw", lines }];
      }
    },
    extractStatusLines: () => [],
    extractInputDraft: () => null,
  };
}

function pane(model: PickerModel, revision = 7) {
  return { paneId: "w1:p1", text: encode(model), truncated: false, revision };
}

function script(...models: Array<PickerModel | null>) {
  const queue = [...models];
  mockFetchPane.mockImplementation(async () => {
    const model = queue.length > 1 ? queue.shift()! : queue[0]!;
    return model === null ? { paneId: "w1:p1", text: "", truncated: false, revision: 7 } : pane(model);
  });
}

function args(picker: PickerModel, intent: Parameters<typeof submitPickerIntent>[0]["intent"]) {
  return {
    paneId: "w1:p1",
    requestedLines: 200,
    detectedRevision: 7,
    picker,
    intent,
    agent: "codex",
    sleep: async () => {},
  };
}

beforeEach(() => {
  mockFetchPane.mockReset();
  mockSendKeys.mockReset();
  mockAdapterFor.mockReset();
  mockAdapterFor.mockImplementation((agent) => (agent === "codex" ? fakeAdapter() : undefined));
  mockSendKeys.mockResolvedValue({ ok: true });
});

describe("Codex question actions", () => {
  it("moves the native pointer without committing or submitting", async () => {
    const initial = fixturePicker("codex--v0154-question-q1.txt");
    const moved = fixturePicker("codex--v0154-question-q1-selected.txt");
    script(initial, initial, initial, moved);

    const result = await submitPickerIntent(args(initial, { kind: "focus", id: "2" }));

    expect(result).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Down"]]);
    expect(mockSendKeys.mock.calls.flatMap((call) => call[1])).not.toContain("Enter");
    expect(mockSendKeys.mock.calls.flatMap((call) => call[1])).not.toContain("2");
  });

  it("treats moving an answered question's pointer as an edited unanswered answer", async () => {
    const answered = fixturePicker("codex--v0154-question-q1-answered.txt");
    const edited = fixturePicker("codex--v0154-question-q1.txt");
    script(answered, answered, answered, edited);

    const result = await submitPickerIntent(args(answered, { kind: "focus", id: "1" }));

    expect(result).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Up"]]);
  });

  it("navigates to the next question and back with one guarded key each", async () => {
    const first = fixturePicker("codex--v0154-question-q1.txt");
    const second = fixturePicker("codex--v0154-question-q2-unanswered.txt");
    script(first, second, second, first);

    expect(await submitPickerIntent(args(first, { kind: "question", direction: "next" }))).toEqual({
      status: "sent",
    });
    expect(await submitPickerIntent(args(second, { kind: "question", direction: "previous" }))).toEqual({
      status: "sent",
    });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Right"], ["Left"]]);
  });

  it("confirms the last pointed answer with its digit and never sends Enter", async () => {
    const last = fixturePicker("codex--v0154-question-q2.txt");
    script(last, null);

    const result = await submitPickerIntent(args(last, { kind: "confirm" }));

    expect(result).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["1"]]);
    expect(mockSendKeys.mock.calls.flatMap((call) => call[1])).not.toContain("Enter");
  });

  it("confirms a non-final answer with its digit and expects the next question", async () => {
    const first = fixturePicker("codex--v0154-question-q1.txt");
    const second = fixturePicker("codex--v0154-question-q2.txt");
    script(first, second);

    const result = await submitPickerIntent(args(first, { kind: "confirm" }));

    expect(result).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["1"]]);
  });

  it("refuses final confirmation while another question remains unanswered", async () => {
    const last = fixturePicker("codex--v0154-question-q2-unanswered.txt");

    const result = await submitPickerIntent(args(last, { kind: "confirm" }));

    expect(result).toEqual({ status: "changed" });
    expect(mockFetchPane).not.toHaveBeenCalled();
    expect(mockSendKeys).not.toHaveBeenCalled();
  });

  it("refuses a stale pointer before sending any key", async () => {
    const rendered = fixturePicker("codex--v0154-question-q1.txt");
    const stale = fixturePicker("codex--v0154-question-q1-selected.txt");
    script(stale);

    const result = await submitPickerIntent(args(rendered, { kind: "focus", id: "2" }));

    expect(result).toEqual({ status: "changed" });
    expect(mockFetchPane).toHaveBeenCalledTimes(1);
    expect(mockSendKeys).not.toHaveBeenCalled();
  });

  it("does not retry a commit key when the bridge rejects it", async () => {
    const last = fixturePicker("codex--v0154-question-q2.txt");
    script(last);
    mockSendKeys.mockResolvedValue({
      ok: false,
      code: "prompt_changed",
      error: "question changed",
    });

    const result = await submitPickerIntent(args(last, { kind: "confirm" }));

    expect(result).toEqual({ status: "changed" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["1"]]);
  });
});
