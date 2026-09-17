import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { describeAdapterConformance } from "../conformance";
import { adapterFor } from "../registry";
import { hermesAdapter } from ".";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const capture = readFileSync(join(PANES, "hermes--done.txt"), "utf8");
const upgraded = readFileSync(join(PANES, "hermes--v0213-done.txt"), "utf8");
const working = readFileSync(join(PANES, "hermes--working.txt"), "utf8");
const submitted = readFileSync(join(PANES, "hermes--submitted-input.txt"), "utf8");
const hint = "msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel";
const lines = (text: string) => splitLines(parseAnsi(text));
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
  it("recognizes v0.21.3 caduceus borders and fixed status without losing paragraphs", () => {
    const source = lines(upgraded);
    const status = hermesAdapter.extractStatusLines(source);
    expect(status).toHaveLength(1);
    expect(lineText(status[0]!)).toContain("☤ deepseek-flash");
    expect(lineText(status[0]!)).toContain("◎ 50.4%");
    expect(status[0]!.segments.every((s) => !s.bg && !s.style.backgroundColor)).toBe(true);
    for (const screen of [upgraded, recut(upgraded, 211, 159)]) {
      const output = hermesAdapter.buildBlocks(lines(screen)).flatMap((block) => block.lines);
      const borders = output.filter((row) => row.fitRule);
      expect(borders).toHaveLength(2);
      expect(lineText(borders[0]!)).toMatch(/^╭─ ☤ Hermes .*╮$/u);
      expect(lineText(borders[1]!)).toMatch(/^╰─+╯$/u);
      expect(borders.every((row) => row.segments.every((s) => !s.muted))).toBe(true);
      expect(output.map(lineText).join("\n")).toContain("response.\n\nA second paragraph");
      expect(output.map(lineText).join("\n")).not.toContain("Turn these notes");
    }
    const currentWorking = working.replaceAll("⚕", "☤");
    expect(hermesAdapter.extractStatusLines(lines(currentWorking))).toHaveLength(2);
    expect(mirror(currentWorking)).not.toContain(hint);
    const drafted = currentWorking.split("\n").map((row) =>
      row.includes("❯") ? "☤ ❯ A real draft" : row).join("\n");
    expect(mirror(drafted)).toContain("A real draft");
  });

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

  it("lifts the working metrics and operation hint into consecutive fixed rows", () => {
    const status = hermesAdapter.extractStatusLines(lines(working));
    expect(status).toHaveLength(2);
    expect(lineText(status[0]!)).toContain("example-model");
    expect(lineText(status[1]!)).toBe(hint);
    expect(mirror(working)).toBe(lines(working).slice(0, 4).map(lineText).join("\n"));
    expect(hermesAdapter.extractInputDraft(lines(working))).toBeNull();
    expect(hermesAdapter.extractStatusLines(lines(capture))).toHaveLength(1);
  });

  it.each(["⚕ ❯ ", "⚕ "])("handles the working prompt %s and physically wrapped hints", (prompt) => {
    for (const at of [0, 7, 28, 43]) {
      const wrapped = hint.slice(0, at) + "\n    " + hint.slice(at);
      const text = working.replace("⚕ ❯ ", prompt).replace(hint, wrapped);
      const status = hermesAdapter.extractStatusLines(lines(text));
      expect(status).toHaveLength(2);
      expect(lineText(status[1]!)).toBe(hint);
      expect(mirror(text)).not.toContain("msg=interrupt");
    }
  });

  it("retains working drafts, typed hint copies and unknown placeholders", () => {
    for (const draft of [hint, "Keep this draft\n  and its next line\n\n  [image #1] /tmp/example.png"]) {
      const text = working.split("\n").map((row) => row.includes("❯") ? `⚕ ❯ ${draft}` : row).join("\n");
      expect(hermesAdapter.extractStatusLines(lines(text))).toHaveLength(1);
      expect(mirror(text)).toContain(draft);
    }
    const unknown = working.replace(hint, "An unknown italic working hint");
    expect(mirror(unknown)).toContain("An unknown italic working hint");
    expect(hermesAdapter.extractStatusLines(lines(unknown))).toHaveLength(1);
  });

  it("leaves incomplete working footers and unknown special-state prompts in the mirror", () => {
    for (const text of [
      working.trimEnd().split("\n").slice(0, -1).join("\n"),
      `${working}\nEnter to approve`,
      // 🔒 is not a Hermes state icon (the source paints 🔐 for sudo); ⚠ and 🔑 ARE, and are
      // covered by the recognized cases below.
      working.replace("⚕ ❯ ", "🔒 ❯ "),
      working.replace("⚕ ❯ ", "☎ ❯ "),
    ]) {
      expect(hermesAdapter.extractStatusLines(lines(text))).toEqual([]);
      expect(mirror(text)).toContain(hint);
    }
  });

  it("recognizes the source's closed set of special-state prompt icons", () => {
    for (const icon of ["⚠", "🔐", "🔑", "⠋", "⠼", "●", "◉", "🎤"]) {
      const text = working.replace("⚕ ❯ ", `${icon} ❯ `);
      expect(hermesAdapter.extractStatusLines(lines(text))).toHaveLength(2);
      expect(lineText(hermesAdapter.extractStatusLines(lines(text))[0]!)).toContain("example-model");
    }
  });

  it("recognizes a profile-prefixed prompt", () => {
    const text = working.replace("⚕ ❯ ", "coder ❯ ");
    expect(hermesAdapter.extractStatusLines(lines(text))).toHaveLength(2);
    expect(mirror(text)).toBe(lines(working).slice(0, 4).map(lineText).join("\n"));
  });

  it("lifts a busy command's spinner prompt and its italic status into the strip", () => {
    // The /compact screen: the icon is a spinner frame and the placeholder names the command.
    const busy = working.replace("⚕ ❯ ", "⠋ ❯ ").replace(hint, "⠋ Compressing context...");
    const status = hermesAdapter.extractStatusLines(lines(busy));
    expect(status).toHaveLength(2);
    expect(lineText(status[1]!)).toBe("⠋ Compressing context...");
    expect(mirror(busy)).not.toContain("Compressing context");
  });

  it("lifts a wrapped statusline and its title row during a password prompt", () => {
    // The measured resume-session screen: the statusline wraps at the pane width and the
    // right-aligned title lands on its own row, all above the 🔑 composer.
    const fill = (text: string) => `\x1b[48;5;234m${text}\x1b[0m`;
    const rule = "─".repeat(40);
    const text = [
      "Transcript above.",
      fill(" ⚕ deepseek-flash │ ~126K/1M │ [██░░░░░░] ~13% │ ◎"),
      fill("77.5% │ ◎ 3.8s │ ↑ 136 t/s │ 2h 29m │ ⏲ 32s"),
      fill("──────────── 查询刚才保存的方案"),
      rule,
      "🔑 ❯ \x1b[3mtype password (hidden), Enter to submit · ESC to skip\x1b[0m",
      rule,
    ].join("\n");
    const status = hermesAdapter.extractStatusLines(lines(text));
    const joined = status.map((row) => lineText(row)).join(" ");
    // The wrapped status rows are joined into ONE strip row, beside the lifted instruction.
    expect(status).toHaveLength(2);
    expect(joined).toContain("deepseek-flash");
    expect(joined).toContain("~126K/1M");
    expect(joined).toContain("77.5%");
    expect(joined).toContain("查询刚才保存的方案");
    // The password instruction is lifted as the hint rather than lost with the composer block.
    expect(joined).toContain("type password (hidden)");
    expect(mirror(text)).not.toContain("type password");
    expect(mirror(text)).toContain("Transcript above.");
  });

  it("keeps a real typed draft on a special-state prompt visible", () => {
    // A draft is not italic, so it is no placeholder: the composer block stays in the mirror.
    const rule = "─".repeat(40);
    const text = [
      "Body before.",
      " ⚕ deepseek-flash │ ~126K/1M │ [██░░░░░░] ~13%",
      rule,
      "🔑 ❯ a typed draft",
      rule,
    ].join("\n");
    expect(hermesAdapter.extractStatusLines(lines(text))).toHaveLength(1);
    expect(mirror(text)).toContain("a typed draft");
    expect(mirror(text)).toContain("Body before.");
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
    // Only the footer is gone, and every row above it keeps its index — `latest-reply` maps a
    // reply's last row onto this array, so a source row removed up here would hide the wrong rows.
    expect(output).toHaveLength(rows.findIndex((row) => lineText(row).startsWith(" ⚕ ")));
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

  it("preserves the captured frame, moves the status and hides only the empty prompt", () => {
    expect(mirror(capture)).toBe(lines(capture).slice(0, 5).map(lineText).join("\n"));
    const output = hermesAdapter.buildBlocks(lines(capture))[0]!.lines;
    expect(output[0]!.fitRule).toBeDefined();
    expect(output[4]!.fitRule).toBeDefined();
    const status = hermesAdapter.extractStatusLines(lines(capture));
    expect(status).toHaveLength(1);
    expect(lineText(status[0]!)).toContain("~19.5K/1M");
    expect(lineText(status[0]!)).toContain("◎ 65.3%");
    expect(lineText(status[0]!)).toContain("Example conversation");
    expect(status[0]!.segments.every((s) => !s.bg && !s.style.backgroundColor)).toBe(true);
    expect(status[0]!.segments.find((s) => s.text.includes("Example conversation"))?.fg).toBe("rgb(255,215,0)");
  });

  it("also hides a genuinely empty prompt, while preserving typed drafts verbatim", () => {
    // Replace the whole captured prompt row, retaining both independently captured boundaries.
    const replacePrompt = (draft: string) => capture.split("\n").map((row) => row.includes("❯") ? `❯ ${draft}` : row).join("\n");
    expect(mirror(replacePrompt(""))).not.toContain("❯");
    const drafted = replacePrompt("A draft\n  with another line\n\n  [image #1] /tmp/example.png");
    expect(mirror(drafted)).toContain("❯ A draft\n  with another line\n\n  [image #1] /tmp/example.png");
    expect(hermesAdapter.extractStatusLines(lines(drafted))).toHaveLength(1);
  });

  it("preserves Markdown, tables, nested boxes and rules inside the response", () => {
    const body = "---\n| a | b |\n| - | - |\n╭────────╮\n│ keep   │\n╰────────╯\n────────────────────────────────────────";
    expect(mirror(capture.replace("A verified response with a real paragraph break.", body))).toContain(body);
  });

  it("leaves torn footers and menus visible instead of guessing an input region", () => {
    const rows = capture.trimEnd().split("\n");
    for (const text of [rows.slice(0, -1).join("\n"), `${capture}\nChoose a model\nEnter to select`, capture.replace("❯", ">"), capture.replaceAll("⚕", "Other")]) {
      expect(hermesAdapter.extractStatusLines(lines(text))).toEqual([]);
      expect(mirror(text)).toContain("Plan a feature");
    }
  });

  it("fits a clipped response's closing border when the Hermes footer confirms its width", () => {
    const clipped = capture.split("\n").slice(1).join("\n");
    expect(mirror(clipped)).toContain("╰────");
    expect(hermesAdapter.buildBlocks(lines(clipped))[0]!.lines.at(-1)!.fitRule).toBeDefined();
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

  it("rejoins status fragments without inserting spaces inside a model or metric", () => {
    const status = " ⚕ example-model │ ~19.5K/1M │ [░░░░░░░░░░] ~2% │ ◎ 65.3% │ ↑ 198 t/s";
    const rule = "─".repeat(40);
    for (const at of [8, 47, 67]) {
      const screen = `Body.\n${status.slice(0, at)}\n${status.slice(at)}\n${rule}\n❯ \n${rule}`;
      expect(lineText(hermesAdapter.extractStatusLines(lines(screen))[0]!)).toBe(status);
      expect(mirror(screen)).toBe("Body.");
    }
  });

  it("is display-only and exact-name scoped", () => {
    expect(adapterFor("hermes")).toBe(hermesAdapter);
    expect(adapterFor("hermes-other")).toBeUndefined();
    expect(hermesAdapter.displayOnly).toBe(true);
    expect(hermesAdapter.extractInputDraft(lines(capture))).toBeNull();
    expect(hermesAdapter.composerReady).toBeUndefined();
  });
});

describeAdapterConformance(hermesAdapter, {
  ownFixtures: [],
  foreignFixtures: readdirSync(PANES).filter((name) => !name.startsWith("hermes--") && name.endsWith(".txt")),
  neutralFixtures: ["hermes--done.txt", "hermes--working.txt", "hermes--submitted-input.txt"],
});
