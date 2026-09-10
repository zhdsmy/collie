import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { hermesAdapter } from "./index";
import { decorateHermesDiff } from "./display";

const sample = readFileSync(join(import.meta.dirname, "../../../fixtures/panes/hermes--diff.txt"), "utf8");
const parse = (text: string) => splitLines(parseAnsi(text));

it("paints Hermes changes as Codex diff rectangles without modifying text or source styles", () => {
  const lines = parse(sample), before = structuredClone(lines);
  const result = decorateHermesDiff(lines);
  expect(result.map(lineText)).toEqual(lines.map(lineText));
  expect(result.filter((line) => line.surface).map((line) => line.surface)).toEqual([
    { kind: "diff", background: "rgb(74,34,29)" }, { kind: "diff", background: "rgb(74,34,29)" },
    { kind: "diff", background: "rgb(33,58,43)" }, { kind: "diff", background: "rgb(33,58,43)" },
  ]);
  expect(lines).toEqual(before);
  expect(hermesAdapter.buildBlocks(lines)[0]!.lines.filter((l) => l.surface)).toHaveLength(4);
});

it("supports truecolor skins and split ANSI runs without touching context or hunk headers", () => {
  const text = "@@ -1 +1 @@\n\x1b[38;2;255;255;255;48;2;120;20;20m- \x1b[1mold\x1b[0m\n\x1b[38;2;255;255;255;48;2;20;90;20m+ new\x1b[0m";
  const rows = decorateHermesDiff(parse(text));
  expect(rows[0]!.surface).toBeUndefined();
  expect(rows[1]!.surface?.background).toBe("rgb(74,34,29)");
  expect(rows[1]!.segments.at(-1)!.bold).toBe(true);
  expect(rows[2]!.surface?.background).toBe("rgb(33,58,43)");
});

it.each([
  "\x1b[38;5;231;48;5;22m+ A colored log without a hunk\x1b[0m",
  "@@ -1 +1 @@\n+ Unpainted diff\n\x1b[38;5;231;48;5;22m+ A later log\x1b[0m",
  "@@ -1 +1 @@\nDone.\n\x1b[38;5;231;48;5;22m+ A later log\x1b[0m",
])("leaves unrelated colored output untouched", (text) => {
  expect(decorateHermesDiff(parse(text)).some((line) => line.surface)).toBe(false);
});
