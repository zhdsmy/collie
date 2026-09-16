import { describe, expect, it } from "vitest";
import capture from "@/fixtures/panes/hermes--resume-history.txt?raw";
import { parseAnsi } from "../../ansi";
import { dropLeadingLines, lineText, splitLines } from "../../blocks";
import { buildBlocks } from "..";
import { blockOwnsKeyboard } from "../dialog-contract";
import { hermesAdapter } from ".";

const lines = (text: string) => splitLines(parseAnsi(text.trimEnd()));
const blocks = (text: string) => hermesAdapter.buildBlocks(lines(text));
const histories = (text: string) => blocks(text).filter((b) => b.kind === "raw" && b.historyPreview);

describe("Hermes resumed history", () => {
  it("folds the complete native panel without owning the keyboard or changing source row counts", () => {
    const output = blocks(capture);
    expect(histories(capture)).toHaveLength(1);
    expect(output.flatMap((b) => b.lines)).toHaveLength(lines(capture).length);
    expect(output.some(blockOwnsKeyboard)).toBe(false);
    expect(hermesAdapter.displayOnly).toBe(true);
    const body = output.flatMap((b) => b.lines.map(lineText)).join("\n");
    expect(body).toContain("● You:");
    expect(body).toContain("◆ Hermes:");
    expect(body).not.toContain("Previous Conversation");
    expect(body).not.toMatch(/[╭╮╰╯]/u);
    expect(body).toContain("\n\n");
  });

  it("preserves surrounding output and an unfinished repaint instead of swallowing it", () => {
    const rows = capture.trimEnd().split("\n");
    const fragment = rows.slice(0, 4).join("\n");
    const text = `Before history\n${fragment}\n${capture.trimEnd()}\nAfter history`;
    const output = blocks(text);
    expect(histories(text)).toHaveLength(1);
    expect(output[0]!.lines.map(lineText).join("\n")).toContain("Previous Conversation");
    expect(output[0]!.lines.map(lineText)[0]).toBe("Before history");
    expect(output.at(-1)!.lines.map(lineText)).toEqual(["After history"]);
    expect(output.flatMap((b) => b.lines)).toHaveLength(lines(text).length);
  });

  it("leaves cropped, unstyled, unknown, mismatched and broken panels raw", () => {
    const rows = capture.trimEnd().split("\n");
    for (const text of [
      rows.slice(0, -1).join("\n"),
      rows.slice(1).join("\n"),
      lines(capture).map(lineText).join("\n"),
      capture.replace("Previous Conversation", "Ordinary Conversation"),
      [...rows.slice(0, -1), rows.at(-1)!.replace("──", "─")].join("\n"),
      [...rows.slice(0, 3), "This is ordinary terminal output", ...rows.slice(3)].join("\n"),
    ]) expect(histories(text)).toEqual([]);
  });

  it.each(["claude", "codex", "hermes-custom", undefined])("does not fold the panel for %s", (agent) => {
    expect(buildBlocks(lines(capture), { agent }).some((b) => b.kind === "raw" && b.historyPreview)).toBe(false);
  });

  it("removes fold metadata when the latest-reply view subtracts part of the history", () => {
    const raw = blocks(capture).filter((b) => b.kind === "raw");
    expect(dropLeadingLines(raw, 0)).toBe(raw);
    const partial = dropLeadingLines(raw, 2);
    expect(partial[0]!.historyPreview).toBeUndefined();
    expect(partial[0]!.lines).toEqual(raw[0]!.lines.slice(2));
    expect(dropLeadingLines(raw, raw[0]!.lines.length)).toEqual([]);
  });
});
