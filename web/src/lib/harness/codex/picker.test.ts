import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { detectPickerRegion } from "./picker";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const text = (state: string) => readFileSync(join(PANES, `codex--v0154-picker-${state}.txt`), "utf8");
const parse = (source: string) => splitLines(parseAnsi(source));
const fixture = (state: string) => parse(text(state));
const model = (state: string) => detectPickerRegion(fixture(state))!.model;

describe("Codex native picker parsing", () => {
  it("reads visible model labels and descriptions without baking in a model catalogue", () => {
    const picker = model("model");
    expect(picker.title).toBe("Select Model and Effort");
    expect(picker.kind).toBe("single");
    expect(picker.query).toBeNull();
    expect(picker.options[1]).toMatchObject({ id: "2", label: "gpt-5.6-sol", description: "Latest frontier agentic coding model.", pointed: false });
    const changed = detectPickerRegion(parse(text("model").replaceAll("gpt-5.6-sol", "future-model")));
    expect(changed!.model.options[1]!.label).toBe("future-model");
    expect(changed!.model.signature).not.toBe(picker.signature);
  });

  it("retains reasoning defaults, advanced choices, and usage warnings", () => {
    expect(model("effort").options[0]!.label).toBe("Low (default)");
    expect(model("effort").options.at(-1)!.label).toBe("More reasoning…");
    expect(model("advanced").description).toEqual(["⚠ Consumes usage limits faster"]);
    expect(model("advanced").options.map((option) => option.label)).toEqual(["Max", "Ultra"]);
  });

  it("distinguishes the saved current value from the pointer", () => {
    const source = text("model").replace("gpt-5.6-sol", "gpt-5.6-sol (current)");
    const picker = detectPickerRegion(parse(source))!.model;
    expect(picker.options[0]!.pointed).toBe(true);
    expect(picker.options[1]).toMatchObject({ label: "gpt-5.6-sol", current: true, pointed: false });
  });

  it("preserves the explicit Plan override versus global-default choice", () => {
    const picker = model("scope");
    expect(picker.title).toBe("Apply reasoning change");
    expect(picker.description).toEqual(["Choose where to apply high reasoning."]);
    expect(picker.options.map((option) => option.label)).toEqual([
      "Apply to Plan mode override",
      "Apply to global default and Plan mode override",
    ]);
    expect(picker.options[1]!.description).toContain("built-in Plan default (medium)");
  });

  it("keeps checked state and order separate from the pointer and preview", () => {
    const initial = model("statusline");
    expect(initial.options[0]).toMatchObject({ id: "Use theme colors", checked: true, orderable: false });
    expect(initial.options[1]).toMatchObject({ id: "model-with-reasoning", checked: true, orderable: true });
    expect(model("statusline-moved").options.slice(1, 3).map((option) => option.id)).toEqual(["context-remaining", "model-with-reasoning"]);
    expect(model("statusline-toggled").options.find((option) => option.id === "model-with-reasoning")!.checked).toBe(false);
    expect(model("statusline-toggled").preview.map(lineText).join("\n")).not.toContain("gpt-5.6 default");
  });

  it("reads native search, no matches, and scrolled windows without inventing hidden rows", () => {
    expect(model("statusline-search").query).toBe("context");
    expect(model("statusline-search").options.map((option) => option.id)).toEqual(["context-remaining", "context-used", "context-window-size"]);
    expect(model("statusline-empty").options).toEqual([]);
    expect(model("statusline-empty").query).toBe("contextzzz");
    const scrolled = model("statusline-scrolled");
    expect(scrolled.options[0]!.id).toBe("context-window-size");
    expect(scrolled.options.at(-1)!.id).toBe("fast-mode");
    expect(scrolled.options.some((option) => option.id === "Use theme colors")).toBe(false);
  });

  it("keeps an all-disabled picker interactive when Codex omits its preview row", () => {
    const empty = model("statusline-no-preview");
    expect(empty.preview).toEqual([]);
    expect(empty.options.every((option) => !option.checked)).toBe(true);
  });

  it("does not lift plain-text transcripts that quote a menu", () => {
    const lines = fixture("model").map((line) => ({ segments: [{ text: lineText(line), style: {}, muted: false }] }));
    expect(detectPickerRegion(lines)).toBeNull();
  });

  it.each(["model", "effort", "advanced", "statusline", "statusline-search", "statusline-empty"])("refuses torn or stale %s menus", (state) => {
    const lines = fixture(state);
    const last = lines.findLastIndex((line) => lineText(line).trim().length > 0);
    expect(detectPickerRegion(lines.slice(0, last))).toBeNull();
    expect(detectPickerRegion([...lines, { segments: [{ text: "New output after menu", style: {}, muted: false }] }])).toBeNull();
    const withoutTitle = lines.map((line) => lineText(line).trim() === model(state).title ? { segments: [] } : line);
    expect(detectPickerRegion(withoutTitle)).toBeNull();
  });

  it("refuses duplicate pointers, duplicate options and unknown control rows", () => {
    expect(detectPickerRegion(parse(text("model").replace("  2. gpt-5.6-sol", "› 2. gpt-5.6-sol")))).toBeNull();
    expect(detectPickerRegion(parse(text("model").replace("  2. gpt-5.6-sol", "  1. gpt-5.6-sol")))).toBeNull();
    const lines = fixture("statusline");
    const at = lines.findIndex((line) => lineText(line).startsWith("› "));
    const altered: StyledLine[] = [...lines.slice(0, at), { segments: [{ text: "Unknown modal action", style: {}, muted: false }] }, ...lines.slice(at)];
    expect(detectPickerRegion(altered)).toBeNull();
  });

  it("leaves every pre-existing agent fixture outside the picker grammar", () => {
    const others = readdirSync(PANES).filter((name) => name.endsWith(".txt") && !name.startsWith("codex--v0154-picker-"));
    for (const file of others) expect(detectPickerRegion(parse(readFileSync(join(PANES, file), "utf8"))), file).toBeNull();
  });
});
