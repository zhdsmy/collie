import dialog from "@/fixtures/panes/claude--permission-bash.txt?raw";
import { claudeDiffSample } from "@/test/claude-diff";
import { parseAnsi } from "../../ansi";
import { splitLines, lineText } from "../../blocks";
import { claudeAdapter } from "./index";
import { decorateClaudeDiff } from "./display";

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
  expect(blocks[0]!.lines.filter((line) => line.surface)).toHaveLength(5);
});
