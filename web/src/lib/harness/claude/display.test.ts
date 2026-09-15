import dialog from "@/fixtures/panes/claude--permission-bash.txt?raw";
import { claudeDiffSample } from "@/test/claude-diff";
import { parseAnsi } from "../../ansi";
import { splitLines, lineText } from "../../blocks";
import { claudeAdapter } from "./index";
import { decorateClaudeDiff, decorateClaudeUser } from "./display";

const parse = (text: string) => splitLines(parseAnsi(text));

it("fills numbered Claude diff rows without changing text, paint or source rows", () => {
  const lines = parse(claudeDiffSample), original = structuredClone(lines);
  const result = decorateClaudeDiff(lines);
  expect(result.map(lineText)).toEqual(lines.map(lineText));
  expect(result.filter((line) => line.surface).map((line) => line.surface?.background)).toEqual([
    "rgb(48,0,0)", "rgb(48,0,0)", "rgb(48,0,0)", "rgb(0,40,0)", "rgb(0,40,0)",
  ]);
  expect(result.map((line) => line.segments)).toEqual(lines.map((line) => line.segments));
  expect(lines).toEqual(original);
});

it("uses ANSI paint rather than a fixed theme palette or a single segment", () => {
  const lines = parse("    \x1b[48;5;52m\x1b[2m123\x1b[22m - old\x1b[0m\n    \x1b[48;5;22m124 + new\x1b[0m");
  expect(decorateClaudeDiff(lines).map((line) => line.surface?.background)).toEqual([
    "rgb(95,0,0)", "rgb(0,95,0)",
  ]);
});

it.each([
  "     12 - ordinary unpainted output",
  "\x1b[41m- unnumbered colored log\x1b[0m",
  "     \x1b[41m12 -\x1b[0m ordinary unpainted message",
  "     \x1b[41m12 \x1b[42m- inconsistent gutter\x1b[0m",
  "     \x1b[41m12   context without a change marker\x1b[0m",
])("leaves unrelated or unfamiliar rows alone", (text) => {
  const lines = parse(text);
  expect(decorateClaudeDiff(lines)).toBe(lines);
});

it("decorates transcript before a dialog without changing its model or retained lines", () => {
  const before = claudeAdapter.buildBlocks(parse(dialog)).at(-1)!;
  const blocks = claudeAdapter.buildBlocks(parse(claudeDiffSample + "\n\n" + dialog));
  expect(blocks.at(-1)).toEqual(before);
  // The fixture's transcript also carries a submitted-input echo; the diff gutter keeps its count.
  const surfaces = blocks[0]!.lines.filter((line) => line.surface);
  expect(surfaces.filter((line) => line.surface?.kind === "diff")).toHaveLength(5);
  expect(surfaces.filter((line) => line.surface?.kind === "user")).toHaveLength(3);
});

const echo = (text: string, fill = "\x1b[48;2;55;55;55m") => text.replaceAll("[F]", fill);

it("promotes the submitted-input echo to one full-row user surface", () => {
  // The live echo shape: a painted `❯ ` marker, white text on the message fill, wrap and blank
  // paragraphs padded with the same fill, and an unpainted row ending the message.
  const text = echo([
    "\x1b[38;2;80;80;80m[F]❯ \x1b[0m\x1b[38;2;255;255;255m[F]first line of the message\x1b[0m[F]   \x1b[0m",
    "[F]  \x1b[0m\x1b[38;2;255;255;255m[F]wrapped continuation\x1b[0m[F]          \x1b[0m",
    "[F]                                        \x1b[0m",
    "[F]  \x1b[0m\x1b[38;2;255;255;255m[F]second paragraph\x1b[0m[F]     \x1b[0m",
    "",
    "\x1b[0mtranscript below\x1b[0m",
  ].join("\n"));
  const result = decorateClaudeUser(parse(text));

  expect(result.map((line) => line.surface?.kind)).toEqual([
    "user", "user", "user", "user", undefined, undefined,
  ]);
  expect(result[0]!.surface!.background).toBe("#1c1c1c");
  // Text, paint and source rows are untouched — only the surface marker is new.
  expect(result.map(lineText)).toEqual(parse(text).map(lineText));
});

it("leaves the unpainted prompt, tool rows and diff rows alone", () => {
  const lines = parse([
    "❯ \x1b[7m \x1b[0m",                                        // the live composer prompt: no fill
    "\x1b[0m\x1b[38;2;153;153;153m⏺ tool result row\x1b[0m",
    "    \x1b[48;5;52m12 - old\x1b[0m",
  ].join("\n"));
  // The identity guard: an unmatched screen keeps its own array, so nothing downstream re-renders.
  expect(decorateClaudeUser(lines)).toBe(lines);
});

it("decorates the echo rows in the dialog fixtures' transcripts", () => {
  const echoes = claudeAdapter.buildBlocks(parse(dialog))
    .filter((block) => block.kind === "raw")
    .flatMap((block) => block.lines)
    .filter((line) => line.surface?.kind === "user");
  expect(echoes.length).toBeGreaterThan(0);
  expect(echoes.every((line) => lineText(line).startsWith("❯") || lineText(line).trim() === "")).toBe(true);
});
