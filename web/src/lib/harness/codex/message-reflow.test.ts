import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { decorateCodexDisplay } from "./display";
import { codexAdapter } from "./index";
import { reflowCodexMessages } from "./reflow";

const ESC = "\u001b";
const lead = (text: string) => `${ESC}[1;2m\u203a ${ESC}[0m${text}`;
const rule = (width: number) => "\u2500 Worked for 1m ".padEnd(width, "\u2500");
function display(rows: string[], wrap = true) {
  const blocks = codexAdapter.buildBlocks(splitLines(parseAnsi(rows.join("\n"))), { wrap });
  const raw = blocks[0]!;
  if (raw.kind !== "raw") throw new Error("Expected raw message output");
  return raw.lines;
}

describe("Codex submitted-message reflow", () => {
  it.each([130, 132])("rejoins the pane-switching request across a %i-column terminal boundary", (columns) => {
    const input = "窗格切换放入右上角三个点旁边，用 icon 显示。Agent 状态就不用保留了，多主机发送目标放在 statusline 下面一行，没有的话默认隐藏。你觉得呢";
    const tailLength = columns === 130 ? 3 : 2;
    const rows = display([
      rule(columns), "", lead(input.slice(0, -tailLength)),
      `  ${input.slice(-tailLength)}`, "", "• Working (6s)",
    ]);
    expect(rows.map(lineText)).toEqual([rule(columns), "", `› ${input}`, "", "• Working (6s)"]);
    expect(rows.filter((row) => row.surface?.kind === "user")).toHaveLength(1);
  });

  it("rejoins the screenshot's live 132-column capture at the CJK cell boundary", () => {
    const first = "/Users/michael/.local/state/collie/uploads/w6_p1-mto7yuue-450995cf.jpg 帮我处理 diff 底色，效果是希望相同颜色行之间没有间隙，然后";
    const second = "底色从左侧延伸到右侧，整体是一个长方形的区块，右侧保留和左侧一样的一个小留白间隙。先看看你理解了没，先别着急动手";
    const rows = display([rule(132), "", lead(first), `  ${second}`, "", "• Working (3s)"]);
    expect(rows.map(lineText)).toEqual([rule(132), "", `\u203a ${first}${second}`, "", "• Working (3s)"]);
    expect(rows[2]!.surface).toEqual({ kind: "user", background: "#1c1c1c" });
    expect(rows[2]!.segments[0]!.bold).toBe(true);
    expect(rows[2]!.segments[0]!.dim).toBe(true);
  });

  it("retains word spacing when Codex wraps a Latin word before the edge", () => {
    const first = "This is a deliberately long message with";
    const rows = display([rule(44), lead(first), `  ${ESC}[36mseveral${ESC}[0m more words.`]);
    expect(lineText(rows[1]!)).toBe(`\u203a ${first} several more words.`);
    expect(rows[1]!.segments.find((segment) => segment.fg)?.text).toBe(" several");
  });

  it.each(["https://example.com/", "/Users/michael/", "singlelongtoken"])(
    "does not insert spaces inside an overlong token starting %s", (prefix) => {
      const first = prefix.padEnd(42, "x");
      const second = "y".repeat(42);
      const rows = display([rule(44), lead(first), `  ${second}`, "  zzz"]);
      expect(rows.map(lineText)).toEqual([rule(44), `\u203a ${first}${second}zzz`]);
    },
  );

  it("keeps short intentional newlines, empty paragraphs and image markers", () => {
    const input = [rule(132), lead("[Image #1]"), "", "  First request.", "  Second request.", "", "  [Image #2]", "  More text."];
    expect(display(input).map(lineText)).toEqual(splitLines(parseAnsi(input.join("\n"))).map(lineText));
  });

  it.each([
    ["fenced code", ["  ```sh", `  ${"a".repeat(42)}`, "  echo next", "  ```"]],
    ["tilde code", ["  ~~~sh", `  ${"a".repeat(42)}`, "  echo next", "  ~~~"]],
    ["indented code", [`      ${"a".repeat(38)}`, "      echo next"]],
    ["list", [`  - ${"a".repeat(40)}`, "    next", "  - second"]],
    ["table", ["  Key | Value", "  --- | ---", `  A | ${"x".repeat(38)}`, "  B | next"]],
    ["quote", [`  > ${"a".repeat(40)}`, "  > next"]],
  ])("preserves %s inside a submitted message", (_name, content) => {
    const input = [rule(44), lead("Inspect this:"), "", ...content];
    expect(display(input).map(lineText)).toEqual(splitLines(parseAnsi(input.join("\n"))).map(lineText));
  });

  it("does not merge messages or leak into answers and tool output", () => {
    const first = "x".repeat(42);
    const rows = display([rule(44), lead(first), lead("A second message"), "", "• Ran command", "  output one", "  output two"]);
    expect(rows.map(lineText)).toEqual([rule(44), `\u203a ${first}`, "\u203a A second message", "", "• Ran command", "  output one", "  output two"]);
  });

  it("uses each turn's ruler after a terminal resize", () => {
    const first = "x".repeat(42);
    const second = "y".repeat(58);
    expect(display([rule(44), lead(first), "  end", rule(60), lead(second), "  tail"]).map(lineText))
      .toEqual([rule(44), `\u203a ${first}end`, rule(60), `\u203a ${second}tail`]);
  });

  it("retains unknown-width and ambiguous-width rows rather than guessing their breaks", () => {
    const input = [lead("x".repeat(42)), "  next"];
    expect(display(input).map(lineText)).toEqual(splitLines(parseAnsi(input.join("\n"))).map(lineText));
    const emoji = [rule(44), lead(`${"x".repeat(40)}\u{1f600}`), "  next"];
    expect(display(emoji).map(lineText)).toEqual(splitLines(parseAnsi(emoji.join("\n"))).map(lineText));
  });

  it("keeps Wrap off column-faithful and never mutates original terminal rows", () => {
    const input = [rule(44), lead("x".repeat(42)), "  next"];
    const lines = decorateCodexDisplay(splitLines(parseAnsi(input.join("\n"))));
    const before = structuredClone(lines);
    const result = reflowCodexMessages(lines);
    expect(result).toHaveLength(2);
    expect(lines).toEqual(before);
    expect(reflowCodexMessages(result)).toBe(result);
    expect(display(input, false).map(lineText)).toEqual(lines.map(lineText));
  });
});
