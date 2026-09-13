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

import { fetchPane, sendKeys, sendReply } from "./api";
import { parseAnsi } from "./ansi";
import { splitLines, type StyledLine } from "./blocks";
import { adapterFor } from "./harness/registry";
import { codexAdapter } from "./harness/codex";
import type { HarnessAdapter } from "./harness/types";
import {
  PICKER_SEARCH_MAX_LENGTH,
  sanitizePickerSearchQuery,
  type PickerModel,
} from "./harness/picker-model";
import {
  submitPickerIntent,
} from "./picker-action";

const mockFetchPane = vi.mocked(fetchPane);
const mockSendKeys = vi.mocked(sendKeys);
const mockSendReply = vi.mocked(sendReply);
const mockAdapterFor = vi.mocked(adapterFor);
const PANES_DIR = join(import.meta.dirname, "..", "fixtures", "panes");

type ModelOptions = {
  kind?: PickerModel["kind"];
  identity?: string;
  pointer?: string;
  query?: string | null;
  order?: string[];
  checked?: string[];
  orderable?: string[];
};

function pickerModel(options: ModelOptions = {}): PickerModel {
  const order = options.order ?? ["alpha", "bravo", "charlie"];
  const checked = new Set(options.checked ?? []);
  const orderable = new Set(options.orderable ?? order);
  const pointer = options.pointer ?? order[0]!;
  const query = options.query ?? "";
  const model: PickerModel = {
    kind: options.kind ?? "multiple",
    identity: options.identity ?? "status-line",
    title: "Configure Status Line",
    description: ["Select which items to display in the status line."],
    options: order.map((id) => ({
      id,
      label: id,
      description: `${id} description`,
      pointed: id === pointer,
      current: id === "alpha",
      checked: checked.has(id),
      orderable: orderable.has(id),
    })),
    query,
    preview: [],
    footer: "Enter to confirm; Esc to close",
    // The real detector supplies a text-sensitive signature. This fixture mirrors that invariant,
    // including pointer, query, checked state, and order so the generic guard remains exercised.
    signature: JSON.stringify({ pointer, query, order, checked: order.filter((id) => checked.has(id)) }),
    regionSignature: `picker:${pointer}:${query}:${order.join(",")}`,
  };
  return model;
}

function encode(model: PickerModel): string {
  return `PICKER ${JSON.stringify(model)}`;
}

function fakeAdapter(): HarnessAdapter {
  return {
    agent: "codex",
    buildBlocks(lines: StyledLine[]) {
      const text = lines.flatMap((line) => line.segments.map((segment) => segment.text)).join("\n");
      if (!text.startsWith("PICKER ")) return [{ kind: "raw", lines }];
      try {
        return [
          {
            kind: "picker",
            // SAFETY: this test adapter receives only JSON produced by `encode`/`checkedFlip`.
            picker: JSON.parse(text.slice("PICKER ".length)) as PickerModel,
            lines,
          },
        ];
      } catch {
        return [{ kind: "raw", lines }];
      }
    },
    extractStatusLines: () => [],
    extractInputDraft: () => null,
  };
}

function fixtureAwareAdapter(): HarnessAdapter {
  const encoded = fakeAdapter();
  return {
    ...codexAdapter,
    buildBlocks(lines: StyledLine[]) {
      const text = lines.flatMap((line) => line.segments.map((segment) => segment.text)).join("\n");
      return text.startsWith("PICKER ")
        ? encoded.buildBlocks(lines)
        : codexAdapter.buildBlocks(lines);
    },
  };
}

function pane(model: PickerModel, revision = 7) {
  return { paneId: "w1:p1", text: encode(model), truncated: false, revision };
}

function fixtureText(name: string): string {
  return readFileSync(join(PANES_DIR, name), "utf8");
}

function fixturePicker(name: string): PickerModel {
  const blocks = codexAdapter.buildBlocks(splitLines(parseAnsi(fixtureText(name))));
  const block = blocks.find((candidate) => candidate.kind === "picker");
  if (!block || block.kind !== "picker") throw new Error(`missing picker fixture: ${name}`);
  return block.picker;
}

function script(...models: PickerModel[]) {
  const queue = [...models];
  mockFetchPane.mockImplementation(async () =>
    pane(queue.length > 1 ? queue.shift()! : queue[0]!),
  );
}

function scriptWithClosedPicker(...models: Array<PickerModel | null>) {
  const queue = [...models];
  mockFetchPane.mockImplementation(async () => {
    const model = queue.length > 1 ? queue.shift()! : queue[0]!;
    return model === null
      ? { paneId: "w1:p1", text: "", truncated: false, revision: 7 }
      : pane(model);
  });
}

function checkedFlip(model: PickerModel, id: string): PickerModel {
  return {
    ...model,
    options: model.options.map((option) =>
      option.id === id ? { ...option, checked: !option.checked } : option,
    ),
    signature: `${model.signature}:checked:${id}`,
    regionSignature: `${model.regionSignature}:checked:${id}`,
  };
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
  mockSendReply.mockReset();
  mockAdapterFor.mockReset();
  mockAdapterFor.mockImplementation((agent) => (agent === "codex" ? fakeAdapter() : undefined));
  mockSendKeys.mockResolvedValue({ ok: true });
  mockSendReply.mockResolvedValue({ ok: true });
});

describe("sanitizePickerSearchQuery", () => {
  it("removes whitespace and control characters without changing visible words", () => {
    expect(sanitizePickerSearchQuery(" git\n branch\t\u001b ")).toBe("gitbranch");
  });

  it("bounds the query", () => {
    expect(sanitizePickerSearchQuery("x".repeat(PICKER_SEARCH_MAX_LENGTH + 10))).toHaveLength(
      PICKER_SEARCH_MAX_LENGTH,
    );
  });
});

describe("submitPickerIntent", () => {
  it("uses the real Codex /model fixture for a guarded cancel", async () => {
    const model = fixturePicker("codex--v0154-picker-model.txt");
    mockAdapterFor.mockReturnValue(fakeAdapter());
    scriptWithClosedPicker(model, model, model, null);

    const res = await submitPickerIntent(args(model, { kind: "cancel" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledWith("w1:p1", ["Escape"], undefined, model.regionSignature);
  });

  it("keeps the real Codex statusline fixture as the toggle baseline", async () => {
    const model = fixturePicker("codex--v0154-picker-statusline.txt");
    const toggled = checkedFlip(model, "Use theme colors");
    mockAdapterFor.mockReturnValue(fakeAdapter());
    scriptWithClosedPicker(model, model, model, toggled);

    const res = await submitPickerIntent(args(model, { kind: "toggle", id: "Use theme colors" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledWith("w1:p1", ["Space"], undefined, model.regionSignature);
    expect(mockSendKeys.mock.calls.flatMap((call) => call[1])).not.toContain("1");
  });

  it("accepts the real all-off statusline fixture with no preview after toggling", async () => {
    const empty = fixturePicker("codex--v0154-picker-statusline-no-preview.txt");
    const baseline = checkedFlip(empty, "current-dir");
    const finalText = fixtureText("codex--v0154-picker-statusline-no-preview.txt");
    const queue = [pane(baseline), pane(baseline), pane(baseline), {
      paneId: "w1:p1",
      text: finalText,
      truncated: false,
      revision: 7,
    }];
    mockAdapterFor.mockReturnValue(fixtureAwareAdapter());
    mockFetchPane.mockImplementation(async () => queue.length > 1 ? queue.shift()! : queue[0]!);

    const res = await submitPickerIntent(args(baseline, { kind: "toggle", id: "current-dir" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledWith("w1:p1", ["Space"], undefined, baseline.regionSignature);
  });

  it("walks a single picker with Up/Down, reads each move, then sends one Enter", async () => {
    const first = pickerModel({ kind: "single", identity: "model", pointer: "alpha" });
    const second = pickerModel({ kind: "single", identity: "model", pointer: "bravo" });
    const third = pickerModel({ kind: "single", identity: "model", pointer: "charlie" });
    // readCurrent: identity guard + current read; each arrow has one guard and one read-back;
    // commitAt has one full guard before Enter.
    scriptWithClosedPicker(first, first, first, second, second, third, third, null);

    const res = await submitPickerIntent(args(first, { kind: "choose", id: "charlie" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([
      ["Down"],
      ["Down"],
      ["Enter"],
    ]);
    expect(mockSendKeys.mock.calls.every((call) => call[3] !== undefined)).toBe(true);
  });

  it("toggles a pointed multiple option with Space and never a numeric shortcut", async () => {
    const model = pickerModel({ pointer: "bravo", checked: ["alpha"] });
    const toggled = checkedFlip(model, "bravo");
    scriptWithClosedPicker(model, model, model, toggled);

    const res = await submitPickerIntent(args(model, { kind: "toggle", id: "bravo" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Space"]]);
    expect(mockSendKeys.mock.calls.flatMap((call) => call[1])).not.toContain("1");
  });

  it("moves one orderable item with Left/Right and confirms the new order by read-back", async () => {
    const first = pickerModel({ pointer: "bravo" });
    const moved = pickerModel({ pointer: "bravo", order: ["bravo", "alpha", "charlie"] });
    script(first, first, first, moved);

    const res = await submitPickerIntent(args(first, { kind: "move", id: "bravo", direction: "up" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Left"]]);
  });

  it("accepts a one-row viewport shift when browsing past the visible edge", async () => {
    const first = pickerModel({ pointer: "bravo", order: ["alpha", "bravo"] });
    const shifted = pickerModel({ pointer: "charlie", order: ["bravo", "charlie"] });
    script(first, first, first, shifted);

    const res = await submitPickerIntent(args(first, { kind: "navigate", direction: "down" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Down"]]);
  });

  it("accepts a native clamp at the visible edge", async () => {
    const first = pickerModel({ pointer: "alpha", order: ["alpha", "bravo"] });
    scriptWithClosedPicker(first, first, first, first);

    const res = await submitPickerIntent(args(first, { kind: "navigate", direction: "up" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Up"]]);
    expect(mockFetchPane).toHaveBeenCalledTimes(4);
  });

  it("accepts a validated wrap at the visible edge", async () => {
    const first = pickerModel({ pointer: "charlie" });
    const wrapped = pickerModel({ pointer: "alpha" });
    scriptWithClosedPicker(first, first, first, wrapped);

    const res = await submitPickerIntent(args(first, { kind: "navigate", direction: "down" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Down"]]);
  });

  it("accepts a validated wrap between disjoint visible windows", async () => {
    const first = pickerModel({ pointer: "alpha", order: ["alpha", "bravo", "charlie"] });
    const wrapped = pickerModel({ pointer: "zulu", order: ["xray", "yankee", "zulu"] });
    scriptWithClosedPicker(first, first, first, wrapped);

    const res = await submitPickerIntent(args(first, { kind: "navigate", direction: "up" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Up"]]);
  });

  it("rejects a viewport shift when a shared row changes its checked state", async () => {
    const first = pickerModel({ pointer: "bravo", order: ["alpha", "bravo"], checked: ["alpha"] });
    const drifted = pickerModel({ pointer: "charlie", order: ["bravo", "charlie"], checked: ["bravo"] });
    script(first, first, first, drifted);

    const res = await submitPickerIntent(args(first, { kind: "navigate", direction: "down" }));

    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Down"]]);
  });

  it("rejects sorting while search is active and leaves the terminal untouched", async () => {
    const model = pickerModel({ query: "git", pointer: "alpha" });
    const res = await submitPickerIntent(args(model, { kind: "move", id: "alpha", direction: "down" }));

    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys).not.toHaveBeenCalled();
    expect(mockFetchPane).not.toHaveBeenCalled();
  });

  it("replaces search with Backspace and raw submit=false text, then reads the query", async () => {
    const old = pickerModel({ query: "old", pointer: "alpha" });
    const cleared = pickerModel({ query: "", pointer: "alpha" });
    const landed = pickerModel({ query: "git", pointer: "alpha" });
    script(old, old, old, old, cleared, landed);

    const res = await submitPickerIntent(args(old, { kind: "search", query: " g\nit " }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Backspace", "Backspace", "Backspace"]]);
    expect(mockSendKeys).not.toHaveBeenCalledWith("w1:p1", ["Enter"], expect.anything(), expect.anything());
    expect(mockSendReply).toHaveBeenCalledWith("w1:p1", "git", false, undefined, cleared.regionSignature);
  });

  it("rejects search read-back when picker preview or footer drifts", async () => {
    const old = pickerModel({ query: "", pointer: "alpha" });
    const drifted = {
      ...pickerModel({ query: "git", pointer: "alpha" }),
      footer: "changed footer",
      preview: [{ segments: [] }],
    };
    script(old, old, drifted);

    const res = await submitPickerIntent(args(old, { kind: "search", query: "git" }));

    expect(res).toEqual({ status: "changed" });
    expect(mockSendReply).toHaveBeenCalledWith("w1:p1", "git", false, undefined, old.regionSignature);
  });

  it("stops before a key when checked/query/order state drifts under the rendered card", async () => {
    const rendered = pickerModel({ checked: ["alpha"], pointer: "alpha" });
    const drifted = pickerModel({ checked: ["bravo"], pointer: "alpha" });
    script(drifted);

    const res = await submitPickerIntent(args(rendered, { kind: "toggle", id: "alpha" }));

    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys).not.toHaveBeenCalled();
  });

  it("rejects a toggle read-back when another option changes", async () => {
    const model = pickerModel({ pointer: "bravo", checked: ["alpha"] });
    const drifted = pickerModel({ pointer: "bravo", checked: ["alpha", "charlie"] });
    scriptWithClosedPicker(model, model, model, drifted);

    const res = await submitPickerIntent(args(model, { kind: "toggle", id: "bravo" }));

    expect(res).toEqual({ status: "changed" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Space"]]);
  });

  it("accepts a single-picker choice that opens its successor stage", async () => {
    const model = pickerModel({ kind: "single", identity: "model", pointer: "alpha" });
    const successor = pickerModel({ kind: "single", identity: "effort", pointer: "alpha" });
    scriptWithClosedPicker(model, model, model, successor);

    const res = await submitPickerIntent(args(model, { kind: "choose", id: "alpha" }));

    expect(res).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Enter"]]);
  });

  it("sends Enter only for multiple confirm and Escape for cancel", async () => {
    const model = pickerModel({ pointer: "alpha" });
    scriptWithClosedPicker(model, null, model, null);

    expect(await submitPickerIntent(args(model, { kind: "confirm" }))).toEqual({ status: "sent" });
    expect(await submitPickerIntent(args(model, { kind: "cancel" }))).toEqual({ status: "sent" });
    expect(mockSendKeys.mock.calls.map((call) => call[1])).toEqual([["Enter"], ["Escape"]]);
  });

  it("serializes overlapping actions for the same scoped pane", async () => {
    const model = pickerModel({ pointer: "alpha" });
    scriptWithClosedPicker(model, null);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockSendKeys.mockImplementationOnce(async () => {
      await held;
      return { ok: true };
    });

    const first = submitPickerIntent(args(model, { kind: "confirm" }));
    const second = await submitPickerIntent(args(model, { kind: "confirm" }));
    release();
    const firstResult = await first;

    expect(second).toEqual({ status: "changed" });
    expect(firstResult).toEqual({ status: "sent" });
    expect(mockSendKeys).toHaveBeenCalledTimes(1);
  });
});
