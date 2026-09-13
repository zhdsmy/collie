import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { splitLines, lineText, type StyledLine } from "../../blocks";
import { pickersEqual, pickersSameIdentity } from "../picker-model";
import { detectAskRegion } from "./ask";

const PANES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "panes");

function fixtureLines(name: string): StyledLine[] {
  return splitLines(parseAnsi(readFileSync(join(PANES_DIR, name), "utf8")));
}

function fixtureModel(name: string) {
  const region = detectAskRegion(fixtureLines(name));
  if (!region) throw new Error(`fixture did not detect: ${name}`);
  return region.model;
}

function cloneLines(lines: StyledLine[]): StyledLine[] {
  return lines.map((line) => ({
    ...line,
    segments: line.segments.map((segment) => ({ ...segment })),
  }));
}

function lineMatching(lines: StyledLine[], predicate: (text: string) => boolean): StyledLine {
  const line = lines.find((candidate) => predicate(lineText(candidate)));
  if (!line) throw new Error("expected fixture line");
  return line;
}

function replaceLineText(line: StyledLine, replacement: string): void {
  const first = line.segments[0];
  if (!first) throw new Error("expected styled fixture line");
  line.segments = [{ ...first, text: replacement }];
}

function nonBlank(line: StyledLine) {
  return line.segments.filter((segment) => segment.text.trim() !== "");
}

describe("Codex request_user_input question picker", () => {
  it("lifts the full multiline question and preserves native questionnaire metadata", () => {
    const lines = fixtureLines("codex--v0154-question-q1.txt");
    const model = fixtureModel("codex--v0154-question-q1.txt");
    const questionLines = lines.filter((line) => {
      const text = lineText(line);
      return text.includes("模型选择和状态栏") || text.includes("说明？");
    });

    expect(questionLines).toHaveLength(2);
    expect(model.title).toBe(questionLines.map((line) => lineText(line).trim()).join(" "));
    expect(model.options.map((option) => option.id)).toEqual(["1", "2", "3"]);
    expect(model.options[0]?.label).toContain("同步优化入口");
    expect(model.options[0]?.description).toContain("保持原生选项和说明");
    expect(model.questionnaire).toEqual({
      index: 1,
      total: 2,
      unanswered: 2,
      answered: false,
      submit: "answer",
    });
  });

  it("distinguishes pointer paint from committed-answer paint", () => {
    const pendingLines = fixtureLines("codex--v0154-question-q1.txt");
    const answeredLines = fixtureLines("codex--v0154-question-q1-answered.txt");
    const pending = fixtureModel("codex--v0154-question-q1.txt");
    const answered = fixtureModel("codex--v0154-question-q1-answered.txt");

    const pointed = lineMatching(pendingLines, (text) => text.includes("› 1."));
    expect(nonBlank(pointed).every((segment) => segment.bold && !segment.dim && segment.fg === "var(--ansi-6)")).toBe(
      true,
    );

    const pendingQuestion = lineMatching(pendingLines, (text) => text.includes("模型选择和状态栏"));
    const answeredQuestion = lineMatching(answeredLines, (text) => text.includes("模型选择和状态栏"));
    expect(nonBlank(pendingQuestion).every((segment) => segment.fg === "var(--ansi-6)")).toBe(true);
    expect(nonBlank(answeredQuestion).every((segment) => segment.fg === undefined)).toBe(true);
    expect(pending.questionnaire?.answered).toBe(false);
    expect(answered.questionnaire).toMatchObject({ answered: true, unanswered: 1 });
    expect(answered.options.find((option) => option.pointed)?.id).toBe("2");
  });

  it("keeps metadata in the dialog comparator even when visible question text is unchanged", () => {
    const initial = fixtureModel("codex--v0154-question-q1.txt");
    const selected = fixtureModel("codex--v0154-question-q1-selected.txt");
    const returned = fixtureModel("codex--v0154-question-q1-return.txt");

    expect(initial.title).toBe(selected.title);
    expect(pickersSameIdentity(initial, selected)).toBe(true);
    expect(pickersEqual(initial, selected)).toBe(false);
    expect(pickersEqual(selected, returned)).toBe(true);
    expect(selected.questionnaire).toEqual(returned.questionnaire);
  });

  it("fails closed for notes, torn rows, duplicate pointers, invalid counts, and foreign footers", () => {
    expect(detectAskRegion(fixtureLines("codex--v0154-question-notes.txt"))).toBeNull();

    const torn = cloneLines(fixtureLines("codex--v0154-question-q1.txt"));
    replaceLineText(lineMatching(torn, (text) => text.includes("2. 只优化")), " ");
    expect(detectAskRegion(torn)).toBeNull();

    const duplicate = cloneLines(fixtureLines("codex--v0154-question-q1.txt"));
    const selected = lineMatching(duplicate, (text) => text.includes("› 1."));
    const second = lineMatching(duplicate, (text) => text.includes("2. 只优化"));
    replaceLineText(second, lineText(second).replace(" 2.", " › 2."));
    for (const segment of second.segments) {
      if (segment.text.trim()) Object.assign(segment, { bold: true, dim: false, fg: "var(--ansi-6)" });
    }
    expect(nonBlank(selected).every((segment) => segment.bold && segment.fg === "var(--ansi-6)")).toBe(true);
    expect(detectAskRegion(duplicate)).toBeNull();

    const invalidCount = cloneLines(fixtureLines("codex--v0154-question-q1.txt"));
    replaceLineText(
      lineMatching(invalidCount, (text) => text.includes("Question 1/2")),
      "  Question 1/2 (0 unanswered) ",
    );
    expect(detectAskRegion(invalidCount)).toBeNull();

    const countdown = cloneLines(fixtureLines("codex--v0154-question-q1.txt"));
    replaceLineText(
      lineMatching(countdown, (text) => text.includes("Question 1/2")),
      "  Question 1/2 (2 unanswered) · auto-resolves in 16s",
    );
    expect(detectAskRegion(countdown)).toBeNull();

    const wrongFooter = cloneLines(fixtureLines("codex--v0154-question-q1.txt"));
    replaceLineText(
      lineMatching(wrongFooter, (text) => text.includes("tab to add notes")),
      " tab add notes | enter to submit answer | ←/→ to navigate questions | esc to interrupt ",
    );
    expect(detectAskRegion(wrongFooter)).toBeNull();
  });

  it("rejects an answered-paint mismatch instead of trusting the header count", () => {
    const altered = cloneLines(fixtureLines("codex--v0154-question-q1-answered.txt"));
    const question = lineMatching(altered, (text) => text.includes("模型选择和状态栏"));
    for (const segment of question.segments) {
      if (segment.text.trim()) segment.fg = "var(--ansi-6)";
    }
    expect(detectAskRegion(altered)).toBeNull();
  });
});
