import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { hermesAdapter } from ".";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const capture = readFileSync(join(PANES, "hermes--legacy-done.txt"), "utf8");
const lines = (text: string) => splitLines(parseAnsi(text));
const submitted = readFileSync(join(PANES, "hermes--submitted-input.txt"), "utf8");
const mirror = (text: string) => hermesAdapter.buildBlocks(lines(text)).flatMap((b) => b.lines.map(lineText)).join("\n");

const ESC = "\u001b";
const RESET = `${ESC}[0m`;

/** The SGR run these captures open a row with, up to its first visible character. */
function sgrPrefix(row: string): string {
  let at = 0;
  while (row.startsWith(`${ESC}[`, at)) {
    const end = row.indexOf("m", at);
    if (end < 0) break;
    at = end + 1;
  }
  return row.slice(0, at);
}

/**
 * The capture with its frame borders drawn `frame` columns wide and then cut at `pane` — what Herdr
 * hands back for a frame that was printed while the window was wider than it is now. A live pane
 * measured 2026-09-14 returned exactly this shape: a 211-column frame read back from a 160-column
 * pane, so every `╭─ ⚕ Hermes ─…` row ended without its corner and the next row began with one.
 */
function recut(text: string, frame: number, pane: number): string {
  return text.split("\n").flatMap((row) => {
    const head = sgrPrefix(row);
    const rest = row.slice(head.length);
    const body = rest.endsWith(RESET) ? rest.slice(0, -RESET.length) : rest;
    if (!/^[╭╰]─/u.test(body)) return [row];
    const wide = body.slice(0, -1) + "─".repeat(frame - body.length) + body.slice(-1);
    // The continuation row re-emits the border's SGR, exactly as the emulator did on the live pane.
    return [`${head}${wide.slice(0, pane)}`, `${head}${wide.slice(pane)}${RESET}`];
  }).join("\n");
}

describe("Hermes display chrome", () => {
  it("extends only a captured submitted-input border pair and preserves source text", () => {
    const output = hermesAdapter.buildBlocks(lines(submitted))[0]!.lines;
    expect(output.map((line) => !!line.fullWidthRule)).toEqual([true, false, true]);
    expect(output.map(lineText)).toEqual(lines(submitted).slice(0, 3).map(lineText));
    expect(hermesAdapter.extractInputDraft(lines(submitted))).toBeNull();
  });

  it("keeps multiline input, blank lines and dim preview notices inside the same pair", () => {
    const rows = submitted.replace("keeping real paragraph breaks.", "keeping real paragraph breaks.\n\n[image #1] /tmp/sample.png").trimEnd().split("\n");
    rows.splice(-1, 0, "\x1b[2m... (+8 more lines)\x1b[0m");
    const text = rows.join("\n");
    const output = hermesAdapter.buildBlocks(lines(text))[0]!.lines;
    expect(output.filter((line) => line.fullWidthRule)).toHaveLength(2);
    expect(output.map(lineText).join("\n")).toBe(lines(text).map(lineText).join("\n").trimEnd());
  });

  it("does not extend ordinary rules, plain bullets or incomplete input frames", () => {
    const plain = submitted.replaceAll("\x1b[1m", "");
    const plainBody = submitted.replace("\x1b[1mReview", "\x1b[0mReview");
    const torn = submitted.trimEnd().split("\n").slice(0, -1).join("\n");
    const body = submitted.split("\n").map((row, i) => i === 2 ? `Ordinary response text\n${row}` : row).join("\n");
    for (const text of [plain, plainBody, torn, body, "─".repeat(40)]) {
      expect(hermesAdapter.buildBlocks(lines(text))[0]!.lines.some((line) => line.fullWidthRule)).toBe(false);
    }
  });

  it("paints a fitted frame in the terminal's ink, not the app's rule grey", () => {
    const source = lines(capture);
    const output = hermesAdapter.buildBlocks(source)[0]!.lines;
    // The closing border is nothing but rule glyphs, so the parser marks it decorative chrome and
    // mirror-space repaints it neutral. That is right for a separator and wrong for a frame the
    // skin painted in its accent: it left a message gold on top and grey along the bottom.
    expect(source[4]!.segments.every((s) => s.muted)).toBe(true);
    expect(output[0]!.segments.every((s) => !s.muted && s.fg === source[0]!.segments[0]!.fg)).toBe(true);
    expect(output[4]!.segments.every((s) => !s.muted)).toBe(true);
  });

  it("fits a frame the pane cut in two, without moving a source row", () => {
    const pane = recut(capture, 211, 159);
    const rows = lines(pane);
    const output = hermesAdapter.buildBlocks(rows)[0]!.lines;

    // The border is back on one row, corner and all, on the row the label was already on.
    expect(lineText(output[0]!)).toBe(lineText(rows[0]!) + lineText(rows[1]!));
    expect(output[0]!.fitRule).toBeDefined();
    expect(lineText(output[5]!)).toBe(lineText(rows[5]!) + lineText(rows[6]!));
    expect(output[5]!.fitRule).toBeDefined();

    // The row the wrap landed on is spent, not shown as leftover dashes: a `────╮` floating at the
    // start of a message is the whole complaint. It stays IN the array so `latest-reply`'s row
    // mapping still lines up with the screen, which is why it is blanked rather than deleted.
    expect(lineText(output[1]!)).toBe("");
    expect(lineText(output[6]!)).toBe("");
    // The historical status glyph stays raw; only the recognized input frame is stripped.
    expect(output).toHaveLength(rows.findIndex((row) => /^─{8,}$/.test(lineText(row))));
    expect(output.map(lineText).some((row) => /^─{8,}[╮╯]$/u.test(row))).toBe(false);
  });

  it("leaves dashes that no border opened exactly where they are", () => {
    // A rule row after a closed nested box is not a continuation of anything, and eating it would
    // delete a line the response meant to draw.
    const body = "╭────────╮\n│ keep   │\n╰────────╯\n────────────────────────────────────────";
    const output = hermesAdapter.buildBlocks(lines(capture.replace("A verified response with a real paragraph break.", body)))[0]!.lines;
    expect(mirror(capture.replace("A verified response with a real paragraph break.", body))).toContain(body);
    expect(output.map(lineText)).toContain("────────────────────────────────────────");
  });

  it("preserves Markdown, tables, nested boxes and rules inside the response", () => {
    const body = "---\n| a | b |\n| - | - |\n╭────────╮\n│ keep   │\n╰────────╯\n────────────────────────────────────────";
    expect(mirror(capture.replace("A verified response with a real paragraph break.", body))).toContain(body);
  });

  it.each([40, 80, 159, 240])("recognizes timestamped frames at %i columns without moving body rows", (width) => {
    const label = " ⚕ Hermes 08:31:06 ";
    const top = `╭─${label}${"─".repeat(width - label.length - 3)}╮`;
    const bottom = `╰${"─".repeat(width - 2)}╯`;
    const screen = `${top}\nFirst paragraph.\n\nSecond paragraph.\n${bottom}\nLater output.`;
    const output = hermesAdapter.buildBlocks(lines(screen))[0]!.lines;
    expect(output.map(lineText)).toEqual([top, "First paragraph.", "", "Second paragraph.", bottom, "Later output."]);
    expect(output).toHaveLength(lines(screen).length);
  });

});
