import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { codexAdapter } from "./index";
import { decorateCodexDisplay } from "./display";
import { reflowCodexDiffs } from "./diff-reflow";
import rawCapture from "./diff-reflow.fixture.txt?raw";

// Public CHANGELOG diff captured from Codex's 132-column terminal on 2026-09-05.
const capture = rawCapture.trimEnd();
const ESC = "\u001b";
const red = "74;34;29";
const green = "33;58;43";
const fill = (color: string) => `${ESC}[48;2;${color}m`;
const row = (gutter: string, content: string, color = green) =>
  `${ESC}[0m${fill(color)} ${ESC}[2m${gutter}${ESC}[22;37m${content}${ESC}[0m`;
const numbered = (n: number, content: string, color = green) =>
  row(`${n} `, `${color === green ? "+" : "-"}${content}`, color);
const continuation = (content: string, color = green) => row("    ", content, color);
const padding = (color = green) => `${ESC}[0m${fill(color)}${" ".repeat(20)}${ESC}[0m`;

function display(text: string, wrap = true) {
  return codexAdapter.buildBlocks(splitLines(parseAnsi(text)), { wrap }).flatMap((block) => block.lines);
}

describe("Codex diff reflow", () => {
  it("rejoins the screenshot's split word and URL without changing source rows", () => {
    const rows = display(capture);
    expect(rows).toHaveLength(5);
    expect(lineText(rows[0]!)).toContain("keeping submitted echoes");
    expect(lineText(rows[3]!)).toContain("keeping submitted echoes");
    expect(lineText(rows[3]!)).toContain("https://github.com/zhdsmy/collie/commit/ed3857d");
    expect(rows.map((line) => lineText(line).slice(0, 8))).toEqual(["    29 -", "    29 +", "    30 +", "    31 +", "    32"]);
    expect(rows.slice(0, 4).map((line) => line.surface?.kind)).toEqual(["diff", "diff", "diff", "diff"]);
  });

  it.each([red, green])("preserves literal spaces, source indentation and inline highlights on %s", (color) => {
    const text = [numbered(12, "    const value = keepin", color), continuation(`g + ${ESC}[48;2;60;90;70mhighlight${fill(color)};`, color), numbered(13, "    next();", color)].join("\n");
    const rows = display(text);
    expect(rows.map(lineText)).toEqual([" 12 " + (color === green ? "+" : "-") + "    const value = keeping + highlight;", " 13 " + (color === green ? "+" : "-") + "    next();"]);
    expect(rows[0]!.segments.find((s) => s.bg === "rgb(60,90,70)")?.text).toBe("highlight");
    expect(rows[0]!.segments.find((s) => s.dim)?.text).toBe("12 ");
  });

  it.each([["word ", " next", "word  next"], ["keepin", "g", "keeping"], ["中文", "续行", "中文续行"]])(
    "concatenates source fragments literally: %s / %s", (first, second, expected) => {
      expect(display([numbered(12, first), continuation(second)].join("\n")).map(lineText)).toEqual([` 12 +${expected}`]);
    },
  );

  it("removes only unstyled terminal padding, not source whitespace at the seam", () => {
    const rows = display([numbered(12, "word ") + padding(), continuation(" next") + padding()].join("\n"));
    expect(rows.map(lineText)).toEqual([" 12 +word  next"]);
  });

  it("keeps numbered and empty source lines, changed colors, orphans and ordinary output separate", () => {
    const input = [continuation("orphan"), numbered(12, ""), continuation("after blank"), numbered(13, "one"), continuation("different color", red), numbered(14, "two"), "     ordinary output", numbered(15, "three"), row("   ", "short gutter"), numbered(16, "four")].join("\n");
    expect(display(input).map(lineText)).toEqual(splitLines(parseAnsi(input)).map(lineText));
  });

  it("requires the native dim continuation gutter, not just leading spaces", () => {
    const input = [numbered(12, "keepin"), `${fill(green)}     general output${ESC}[0m`].join("\n");
    expect(display(input).map(lineText)).toEqual(splitLines(parseAnsi(input)).map(lineText));
  });

  it("derives the gutter from the current line-number width", () => {
    const input = [numbered(1234, "keepin"), row("      ", "g"), numbered(1235, "next")].join("\n");
    expect(display(input).map(lineText)).toEqual([" 1234 +keeping", " 1235 +next"]);
  });

  it("does not mistake source numbers and signs in a continuation for a new gutter", () => {
    expect(display([numbered(12, "return "), continuation("123 + 456;")].join("\n")).map(lineText)).toEqual([" 12 +return 123 + 456;"]);
  });

  it("leaves Wrap off and original terminal rows untouched", () => {
    const lines = splitLines(parseAnsi(capture));
    const before = structuredClone(lines);
    codexAdapter.buildBlocks(lines, { wrap: true });
    expect(lines).toEqual(before);
    expect(display(capture, false).map(lineText)).toEqual(lines.map(lineText));
    const reflowed = reflowCodexDiffs(decorateCodexDisplay(lines));
    expect(reflowCodexDiffs(reflowed)).toBe(reflowed);
  });

  it("leaves clipped lines alone and never attaches a continuation across them", () => {
    const lines = decorateCodexDisplay(splitLines(parseAnsi([numbered(12, "keepin"), continuation("g")].join("\n"))));
    lines[0]!.noWrap = true;
    expect(reflowCodexDiffs(lines)).toBe(lines);
  });
});
