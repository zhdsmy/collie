import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { splitLines } from "../../blocks";
import { codexAdapter } from "./index";
import { lineText } from "./markers";

const fruit = readFileSync(join(import.meta.dirname, "../../../fixtures/panes/codex--ask-fruit.txt"), "utf8");
const linesOf = (text: string) => splitLines(parseAnsi(text));

// Layout-only variants of the public capture, not new live captures.
describe("wrapped Codex questions", () => {
  it.each(["question", "description", "footer", "all"])("keeps a wrapped %s native and locks the composer", (part) => {
    let screen = fruit;
    if (part === "question" || part === "all") screen = screen.replaceAll("Pick a fruit?", "Pick a\n  fruit?");
    if (part === "description" || part === "all") {
      screen = screen.replace("Choose a soft, juicy pear.", "Choose a soft,\n                                              juicy pear.");
    }
    if (part === "footer" || part === "all") screen = screen.replace(" | esc to interrupt", "\n  esc to interrupt");
    const lines = linesOf(screen);
    const blocks = codexAdapter.buildBlocks(lines);
    expect(blocks.every((block) => block.kind === "raw")).toBe(true);
    expect(blocks.flatMap((block) => block.lines).map(lineText)).toEqual(lines.map(lineText));
    expect(codexAdapter.composerReady!(lines)).toBe(false);
  });

  it("keeps notes mode native with a wrapped footer and locks the composer", () => {
    const notes = readFileSync(join(import.meta.dirname, "../../../fixtures/panes/codex--ask-notes-focused.txt"), "utf8")
      .replace(" | esc to interrupt", "\n  esc to interrupt");
    const lines = linesOf(notes);
    const blocks = codexAdapter.buildBlocks(lines);
    expect(blocks.every((block) => block.kind === "raw")).toBe(true);
    expect(blocks.flatMap((block) => block.lines).map(lineText)).toEqual(lines.map(lineText));
    expect(codexAdapter.composerReady!(lines)).toBe(false);
  });
});
