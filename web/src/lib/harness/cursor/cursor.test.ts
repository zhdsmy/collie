import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { extractInputDraft, extractStatusLines, stripChrome } from "./chrome";
import { decorateCursorDisplay } from "./display";
import { cursorBuildBlocks } from "./index";

const capture = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "fixtures", "panes", "cursor--idle-sanitized.txt"),
  "utf8",
);
const workingCapture = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "fixtures", "panes", "cursor--working-status-sanitized.txt"),
  "utf8",
);
const reskinnedCapture = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "fixtures", "panes", "cursor--1.11-chrome-sanitized.txt"),
  "utf8",
);

function parsed(text: string): StyledLine[] {
  return splitLines(parseAnsi(text));
}

function tail(prompt: string, statuses: readonly string[]): StyledLine[] {
  const esc = "\x1b[";
  const fill = (text: string) => ` ${esc}48;2;39;39;52m ${text.padEnd(60)}${esc}0m`;
  return parsed([
    "transcript",
    fill(""),
    fill(`→ ${prompt}`),
    fill(""),
    "",
    ...statuses,
  ].join("\n"));
}

describe("Cursor display", () => {
  it("marks every painted query row, including its blank padding, as one user surface", () => {
    const lines = decorateCursorDisplay(parsed(capture));
    expect(lines.slice(0, 3).map((line) => line.surface?.kind)).toEqual(["user", "user", "user"]);
    expect(lines.slice(0, 3).map((line) => line.surface?.background)).toEqual([
      "rgb(47,47,64)",
      "rgb(47,47,64)",
      "rgb(47,47,64)",
    ]);
  });

  it("marks the query block after Cursor re-picked its colour", () => {
    const lines = decorateCursorDisplay(parsed(reskinnedCapture));
    expect(lines.slice(0, 3).map((line) => line.surface)).toEqual(
      Array.from({ length: 3 }, () => ({ kind: "user", background: "rgb(31,31,37)" })),
    );
  });

  it("leaves a short painted fragment alone rather than calling it a block", () => {
    const lines = decorateCursorDisplay(parsed("\x1b[48;2;31;31;37mok\x1b[0m"));
    expect(lines[0]?.surface).toBeUndefined();
  });

  it("marks red and green diff rows while preserving their character-level highlights", () => {
    const lines = decorateCursorDisplay(parsed(capture));
    expect(lines[7]?.surface).toEqual({ kind: "diff", background: "rgb(64,38,38)" });
    expect(lines[8]?.surface).toEqual({ kind: "diff", background: "rgb(43,63,43)" });
    expect(lines[7]?.segments.some((segment) => segment.bg === "rgb(90,46,46)")).toBe(true);
    expect(lines[8]?.segments.some((segment) => segment.bg === "rgb(46,90,46)")).toBe(true);
  });
});

describe("Cursor chrome", () => {
  it("removes the complete input tail and returns the original styled status row", () => {
    const lines = parsed(capture);
    const stripped = stripChrome(lines);
    expect(stripped.map(lineText)).not.toContainEqual(expect.stringContaining("Add a follow-up"));
    expect(stripped.map(lineText)).not.toContainEqual(expect.stringContaining("Auto Balance"));
    expect(stripped).toHaveLength(10);

    const statuses = extractStatusLines(lines);
    expect(statuses).toHaveLength(1);
    expect(lineText(statuses[0]!)).toContain("Auto Balance");
    expect(statuses[0]?.segments.some((segment) => segment.fg === "var(--ansi-6)")).toBe(true);
    expect(extractInputDraft(lines)).toBeNull();
  });

  it("accepts variable working hints and preserves a two-row statusline", () => {
    const lines = tail("Keep going on the migration · ctrl+c to stop", [
      "  Auto · workspace · ▓▓▓░░░ 52%",
      "  Plan · 1 task · branch main",
    ]);
    expect(stripChrome(lines).map(lineText)).toEqual(["transcript"]);
    expect(extractStatusLines(lines).map(lineText)).toEqual([
      "  Auto · workspace · ▓▓▓░░░ 52%",
      "  Plan · 1 task · branch main",
    ]);
  });

  it("extracts both styled rows from the captured working status", () => {
    const statuses = extractStatusLines(parsed(workingCapture));
    expect(statuses.map(lineText)).toEqual([
      "  1 task",
      expect.stringContaining("Auto Balance · sample main ·"),
    ]);
    expect(statuses[0]?.segments.some((segment) => segment.fg === "var(--ansi-4)")).toBe(true);
    expect(statuses[1]?.segments.some((segment) => segment.fg === "var(--ansi-3)")).toBe(true);
  });

  it("extracts the captured working task count and metrics as two styled rows", () => {
    const statuses = extractStatusLines(parsed(workingCapture));
    expect(statuses.map((line) => lineText(line).trim())).toEqual([
      "1 task",
      "Auto Balance · sample main · ▓▓▓▓░░ 82% 223k ↑29.3k · plan 19% (auto 6% api 89%) ↻Sep30",
    ]);
    expect(statuses[0]?.segments.some((segment) => segment.fg === "var(--ansi-4)")).toBe(true);
    expect(statuses[1]?.segments.some((segment) => segment.fg === "var(--ansi-6)")).toBe(true);
  });

  it("hides the input box Cursor now paints in a different colour", () => {
    const lines = parsed(reskinnedCapture);
    expect(stripChrome(lines).map(lineText)).not.toContainEqual(
      expect.stringContaining("Add a follow-up"),
    );
    expect(extractStatusLines(lines).map((line) => lineText(line).trim())).toEqual([
      "1 task",
      expect.stringContaining("Auto Balance · sample main ·"),
    ]);
    expect(extractInputDraft(lines)).toBeNull();
  });

  it("is tail-anchored and refuses neutral, incomplete, or arrowless lookalikes", () => {
    const good = tail("Suggestion text", ["  Auto · workspace · 99%"]);
    const cases = [
      parsed("plain output\n→ Add a follow-up\n  Auto · workspace"),
      good.map((line, index) => index === 2 ? { ...line, segments: [] } : line),
      [...good, ...parsed("\nnew transcript output")],
    ];
    for (const lines of cases) {
      expect(stripChrome(lines)).toBe(lines);
      expect(extractStatusLines(lines)).toEqual([]);
    }
  });

  it("builds one raw display-only block after chrome removal", () => {
    expect(cursorBuildBlocks(parsed(capture))).toMatchObject([
      { kind: "raw", lines: expect.any(Array) },
    ]);
  });
});
