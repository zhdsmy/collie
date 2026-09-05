import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { codexAdapter } from "./index";
import { reflowCodexAnswers } from "./reflow";

function display(rows: string[]) {
  const blocks = codexAdapter.buildBlocks(splitLines(parseAnsi(rows.join("\n"))));
  expect(blocks).toHaveLength(1);
  const block = blocks[0]!;
  if (block.kind !== "raw") throw new Error("Expected raw Codex output");
  return block.lines;
}

describe("Codex answer reflow", () => {
  it("rejoins the screenshot's CJK paragraph without removing paragraph breaks", () => {
    expect(display([
      "• 已完成 v1.5.1+collie.1。",
      "",
      "  正确组合是根节点 100lvh、应用跟随",
      "  可视视口，并用真机截图和点击命中独立验证。",
      "",
      "  单测、类型检查、lint 和构建通过。",
    ]).map(lineText)).toEqual([
      "• 已完成 v1.5.1+collie.1。",
      "",
      "  正确组合是根节点 100lvh、应用跟随可视视口，并用真机截图和点击命中独立验证。",
      "",
      "  单测、类型检查、lint 和构建通过。",
    ]);
  });

  it("rejoins bullet continuations, retaining terminal styling and dropping row padding", () => {
    const rows = display([
      "• 已修复终端折行，\u001b[36m应用跟随\u001b[0m   \u001b[2m  \u001b[0m",
      " \u001b[36m 可视视口\u001b[0m。  ",
    ]);
    expect(rows.map(lineText)).toEqual(["• 已修复终端折行，应用跟随可视视口。"]);
    expect(rows[0]!.segments.filter((s) => s.fg).map((s) => s.text).join(""))
      .toBe("应用跟随可视视口");
  });

  it("keeps Latin word spacing including punctuation at a terminal wrap", () => {
    expect(display([
      "• Updated the app,",
      "  keeping the viewport",
      "  stable.",
    ]).map(lineText)).toEqual(["• Updated the app, keeping the viewport stable."]);
  });

  it("reflows each list item without collapsing separate items or nested content", () => {
    expect(display([
      "• Changes:",
      "",
      "  - First item wraps",
      "    onto another row.",
      "  - Second item stays separate.",
      "    - Nested item",
      "      stays on its own row.",
    ]).map(lineText)).toEqual([
      "• Changes:",
      "",
      "  - First item wraps onto another row.",
      "  - Second item stays separate.",
      "    - Nested item",
      "      stays on its own row.",
    ]);
  });

  it.each([
    ["tool output", ["• Ran command", "  first output row", "  second output row"]],
    ["submitted query", ["› user message", "  first user row", "  second user row"]],
    ["unrecognized output", ["terminal output", "  first row", "  second row"]],
    ["fenced code", ["  ```sh", "  echo one", "  echo two", "  ```"]],
    ["tilde-fenced code", ["  ~~~sh", "  echo one", "  echo two", "  ~~~"]],
    ["indented code", ["      echo one", "      echo two"]],
    ["table", ["  | Name | Value |", "  | --- | --- |", "  | A | B |"]],
    ["table without outer pipes", ["  Name | Value", "  --- | ---", "  A | B"]],
    ["ASCII table", ["  +---+---+", "  | A | B |", "  +---+---+"]],
    ["tree", ["  ├── first", "  └── second"]],
    ["numbered list", ["  1. First", "  2. Second"]],
    ["quote", ["  > First", "  > Second"]],
    ["heading", ["  ## Heading", "  Body"]],
    ["painted block", ["\u001b[48;2;40;40;40m  code one", "  code two\u001b[0m"]],
  ])("preserves %s rows", (_name, rows) => {
    const input = ["• Earlier answer.", "", ...rows];
    const expected = splitLines(parseAnsi(input.join("\n"))).map(lineText);
    expect(display(input).map(lineText)).toEqual(expected);
  });

  it("keeps structural rows separate even without a preceding blank", () => {
    const input = ["• Answer:", "  ```sh", "  echo one", "  echo two", "  ```"];
    expect(display(input).map(lineText)).toEqual(input);
  });

  it("does not mutate terminal rows or add work on unchanged output", () => {
    const input = splitLines(parseAnsi("• 应用跟随\n  可视视口。"));
    const original = structuredClone(input);
    const result = reflowCodexAnswers(input);
    expect(result.map(lineText)).toEqual(["• 应用跟随可视视口。"]);
    expect(input).toEqual(original);
    expect(reflowCodexAnswers(result)).toBe(result);
    const unknown = splitLines(parseAnsi("terminal output\n  first row\n  second row"));
    expect(reflowCodexAnswers(unknown)).toBe(unknown);
  });

  it("keeps upstream separator clipping and submitted-message background handling", () => {
    const rule = `─ Worked for 2m ─${"─".repeat(60)}`;
    const recap = `─ Conversation recap ─${"─".repeat(60)}`;
    const rows = display([
      "• Answer",
      rule,
      recap,
      "\u001b[48;2;240;240;240m› Query\u001b[0m",
      "  User text",
    ]);
    expect(rows.map(lineText)).toEqual(["• Answer", rule, recap, "› Query", "  User text"]);
    expect(rows[1]!.noWrap).toBe(true);
    expect(rows[2]!.noWrap).toBe(true);
    expect(rows[3]!.segments[0]!.mobileTransparentBg).toBe(true);
  });
});
