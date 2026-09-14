import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { extractStatusLines } from "./chrome";
import { modeFieldOf, readClaudeModeState } from "./mode";

// Anchored on this file's directory (see prompt-check tests for why not `new URL(import.meta.url)`).
const PANES = join(import.meta.dirname, "..", "..", "..", "fixtures", "panes");
const fixture = (name: string) => readFileSync(join(PANES, name), "utf8");
const lines = (text: string) => splitLines(parseAnsi(text));

/** The statusline row of a capture, found the way the app finds it. */
function modeRow(text: string) {
  const row = extractStatusLines(lines(text)).find((candidate) => modeFieldOf(candidate) !== null);
  return row === undefined ? null : modeFieldOf(row);
}

describe("the Claude statusline mode field", () => {
  it.each([
    ["claude--draft-footer-single.txt", "⏵⏵ bypass permissions on", true],
    ["claude--working.txt", "⏵⏵ bypass permissions on", true],
    ["claude--draft-wrapped.txt", "⏸ manual mode on", false],
    ["claude--menu-model-picker-dismissed.txt", "⏸ manual mode on", false],
  ])("reads the mode out of %s", (name, mode, hasHint) => {
    const field = modeRow(fixture(name));
    expect(field).not.toBeNull();
    expect(lineText(field!.mode).trim()).toBe(mode);
    expect(field!.hasHint).toBe(hasHint);
  });

  it("keeps the mode's own colour and drops only the hint", () => {
    const field = modeRow(fixture("claude--working.txt"))!;
    // The capture paints the mode pink and the hint grey (two runs); the hint is the part we remove.
    expect(field.mode.segments.every((s) => s.fg === "rgb(255,107,128)")).toBe(true);
    expect(lineText(field.mode)).not.toContain("shift+tab");
  });

  it("refuses a pane whose keyboard a dialog owns", () => {
    // A permission dialog answers on shift+tab — `2. Yes, allow all edits during this session
    // (shift+tab)` — so the control must not exist while one is up, whatever the statusline says.
    const dialog = fixture("claude--permission-edit.txt");
    expect(readClaudeModeState(dialog)).toBeNull();
    expect(readClaudeModeState(`${fixture("claude--draft-footer-single.txt")}`)).not.toBeNull();
  });

  it("refuses a pane with no input box at the tail", () => {
    expect(readClaudeModeState("⏵⏵ bypass permissions on (shift+tab to cycle)")).toBeNull();
  });

  it("binds the write to the composer down to the buffer's tail", () => {
    const state = readClaudeModeState(fixture("claude--draft-footer-single.txt"))!;
    const rows = lines(fixture("claude--draft-footer-single.txt"));
    const last = rows[rows.length - 1 - rows.toReversed().findIndex((row) => lineText(row).trim() !== "")]!;
    expect(state.mode).toBe("⏵⏵ bypass permissions on");
    expect(state.prompt.endsWith(lineText(last).trimEnd())).toBe(true);
    expect(state.prompt).toContain("⏵⏵ bypass permissions on");
  });
});
