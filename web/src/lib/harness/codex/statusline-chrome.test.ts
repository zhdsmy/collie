import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyExpectedPrompt } from "../../../../../bridge/prompt-binding";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import {
  composerPrompt,
  composerReady,
  extractInputDraft,
  extractStatusLines,
  locateComposer,
} from "./chrome";

describe("Codex working-to-idle submit binding", () => {
  it.each([
    "please continue this investigation",
    "请检查锁和写入的时序。\n\n  仅讨论，先别修改代码。",
    "Explain this literal text:\n  tab to queue message",
  ])("keeps the same draft bound when the queue hint disappears: %s", (draft) => {
    const prompt = `\x1b[1m› \x1b[22m${draft}`;
    const working = ["• Working (3s • esc to interrupt)", prompt, "", "tab to queue message", "50% context left"].join("\n");
    const idle = [prompt, "", "  gpt-6-astra · /tmp/probe · Context 50% left · weekly 88% left"].join("\n");
    const before = splitLines(parseAnsi(working));
    const after = splitLines(parseAnsi(idle));
    expect(composerReady(before)).toBe(true);
    expect(composerReady(after)).toBe(true);
    expect(extractInputDraft(before)).toBe(extractInputDraft(after));
    const expected = composerPrompt(before);
    expect(expected).toBe(`› ${draft}`);
    expect(verifyExpectedPrompt(idle, expected!)).toEqual({ ok: true });
    expect(verifyExpectedPrompt(idle.replace("› ", "› changed "), expected!).ok).toBe(false);
  });
});

const PANES = join(import.meta.dirname, "../../../fixtures/panes");

function source(name: string): string {
  return readFileSync(join(PANES, name), "utf8");
}

function lines(name: string) {
  return splitLines(parseAnsi(source(name)));
}

describe("Codex disabled-statusline chrome", () => {
  it("anchors an empty composer on the shortcut/context footer", () => {
    const parsed = lines("codex--v0154-statusline-disabled-idle.txt");

    expect(locateComposer(parsed)).toEqual({ top: 17, promptRow: 17, statusRow: 19 });
    expect(composerReady(parsed)).toBe(true);
    expect(extractInputDraft(parsed)).toBeNull();
    expect(lineText(extractStatusLines(parsed)[0]!)).toContain("? for shortcuts");
  });

  it("keeps a non-empty draft visible when the statusline is disabled", () => {
    const parsed = lines("codex--v0154-statusline-disabled-draft.txt");

    expect(locateComposer(parsed)).toEqual({ top: 17, promptRow: 17, statusRow: 19 });
    expect(composerReady(parsed)).toBe(true);
    expect(extractInputDraft(parsed)).toBe("PICKER_INPUT_PROBE 中文");
  });

  it("anchors the model-only, theme-colours-off status row", () => {
    const parsed = lines("codex--v0154-statusline-single-idle.txt");

    expect(locateComposer(parsed)).toEqual({ top: 17, promptRow: 17, statusRow: 19 });
    expect(composerReady(parsed)).toBe(true);
    expect(extractInputDraft(parsed)).toBeNull();
    expect(lineText(extractStatusLines(parsed)[0]!)).toContain("gpt-5.6-sol");
  });

  it.each([
    "codex--v0154-statusline-disabled-default.txt",
    "codex--v0154-statusline-disabled-idle.txt",
    "codex--v0154-statusline-multiple-muted-default.txt",
    "codex--v0154-statusline-single-color-default.txt",
    "codex--v0154-statusline-single-color-plan.txt",
    "codex--v0154-statusline-single-muted-default.txt",
    "codex--v0154-statusline-single-idle.txt",
  ])("anchors the custom status shape in %s", (name) => {
    const parsed = lines(name);
    expect(locateComposer(parsed)).toEqual({ top: 17, promptRow: 17, statusRow: 19 });
    expect(composerReady(parsed)).toBe(true);
  });

  it("does not let a dim transcript arrow claim a custom footer", () => {
    const altered = lines("codex--v0154-statusline-disabled-idle.txt");
    altered[17]!.segments[0]!.dim = true;
    expect(composerReady(altered)).toBe(false);
  });

  it("requires the coloured mode segment from Codex's footer", () => {
    const altered = source("codex--v0154-statusline-disabled-idle.txt").replace(
      "\u001b[38;5;5m",
      "\u001b[0m",
    );

    expect(composerReady(splitLines(parseAnsi(altered)))).toBe(false);
  });

  it("does not accept a model-only row when the model loses Codex's dim paint", () => {
    const altered = lines("codex--v0154-statusline-single-idle.txt");
    altered.at(-1)!.segments[1]!.dim = false;

    expect(composerReady(altered)).toBe(false);
  });

  it("requires the live arrow to be its own painted segment", () => {
    const altered = lines("codex--v0154-statusline-single-muted-default.txt");
    altered[17]!.segments[0]!.text = "› Ask";

    expect(composerReady(altered)).toBe(false);
  });

  it("requires painted padding above the prompt and below the draft", () => {
    const altered = lines("codex--v0154-statusline-single-muted-default.txt");
    altered[18]!.segments[0]!.bg = undefined;

    expect(composerReady(altered)).toBe(false);
  });

  it.each([
    "codex--trust-prompt.txt",
    "codex--v0154-picker-model.txt",
    "codex--v0154-picker-effort.txt",
    "codex--v0154-picker-statusline.txt",
    "codex--v0154-picker-statusline-no-preview.txt",
  ])("does not treat the footer under %s as a composer", (name) => {
    expect(composerReady(lines(name))).toBe(false);
  });
});
