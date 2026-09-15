import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { blockOwnsKeyboard } from "../dialog-contract";
import { pickersEqual, pickersSameIdentity } from "../picker-model";
import { codexAdapter } from ".";
import { detectAsyncAskRegion } from "./async-ask";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "../../../fixtures/panes", `codex--async-qa-${name}.txt`), "utf8");
const lines = (name: string) => splitLines(parseAnsi(fixture(name)));
const picker = (name: string) => detectAsyncAskRegion(lines(name))!.model;

describe("Codex native async question queue", () => {
  it("keeps the ordinary composer usable while questions are collapsed", () => {
    for (const name of ["collapsed", "collapsed-single"]) {
      const buffer = lines(name);
      const block = codexAdapter.buildBlocks(buffer).at(-1)!;
      expect(block.kind).toBe("picker");
      expect(blockOwnsKeyboard(block)).toBe(false);
      expect(codexAdapter.composerReady!(buffer)).toBe(true);
      expect(picker(name).questionnaire?.async?.collapsed).toBe(true);
    }
  });

  it("recognizes option selection, Other focus and multi-line free text", () => {
    expect(picker("options").options.map((option) => option.label)).toEqual(["Compact cards (recommended)", "Roomy cards", "Other"]);
    expect(picker("selected").options.find((option) => option.pointed)?.id).toBe("2");
    expect(picker("other-empty").questionnaire?.notes).toEqual({ text: "", focused: true });
    expect(picker("other-text").questionnaire?.notes).toEqual({ text: "QA custom answer\n\n第二段 test", focused: true });
    expect(picker("other-stored").questionnaire?.notes?.focused).toBe(false);
    expect(picker("freeform").options).toEqual([]);
    expect(picker("freeform").questionnaire?.notes).toEqual({ text: "", focused: true });
    expect(picker("freeform-text").questionnaire?.notes?.text).toBe("Remember blank lines\n\nKeep the card readable.");
    for (const name of ["options", "other-text", "freeform", "last"]) {
      expect(codexAdapter.composerReady!(lines(name))).toBe(false);
      expect(blockOwnsKeyboard(codexAdapter.buildBlocks(lines(name)).at(-1)!)).toBe(true);
    }
  });

  it("keeps native answer edits in the same question but out of the committing guard", () => {
    expect(pickersSameIdentity(picker("options"), picker("other-text"))).toBe(true);
    expect(pickersEqual(picker("options"), picker("selected"))).toBe(false);
    expect(pickersEqual(picker("other-empty"), picker("other-text"))).toBe(false);
    expect(pickersSameIdentity(picker("options"), picker("freeform"))).toBe(false);
    expect(picker("last").questionnaire).toMatchObject({ index: 1, total: 1, submit: "answer" });
    expect(detectAsyncAskRegion(lines("completed"))).toBeNull();
  });

  it("rejects transcript lookalikes, clipped questions, unsupported keymaps and stale tails", () => {
    for (const name of ["options", "other-text", "freeform", "collapsed"]) {
      const buffer = lines(name);
      expect(detectAsyncAskRegion(splitLines(parseAnsi(buffer.map(lineText).join("\n"))))).toBeNull();
      expect(detectAsyncAskRegion([...buffer, ...splitLines(parseAnsi("New output after question"))])).toBeNull();
    }
    expect(detectAsyncAskRegion(splitLines(parseAnsi(fixture("options").replace("enter submit", "space submit"))))).toBeNull();
    const buffer = lines("options");
    const start = buffer.findIndex((line) => lineText(line).includes("1 of 2"));
    expect(detectAsyncAskRegion(buffer.slice(start))).toBeNull();
  });

  it("does not race the native countdown when opening an otherwise unchanged preview", () => {
    const buffer = lines("collapsed");
    const row = buffer.find((line) => lineText(line).includes("? 2 questions"))!;
    row.segments.push({ text: " · 7s", dim: true, style: { opacity: 0.6 }, muted: false });
    expect(pickersEqual(picker("collapsed"), detectAsyncAskRegion(buffer)!.model)).toBe(true);
  });
});
