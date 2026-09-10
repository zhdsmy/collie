import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { describeAdapterConformance } from "../conformance";
import { adapterFor } from "../registry";
import { hermesAdapter } from ".";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const capture = readFileSync(join(PANES, "hermes--done.txt"), "utf8");
const working = readFileSync(join(PANES, "hermes--working.txt"), "utf8");
const submitted = readFileSync(join(PANES, "hermes--submitted-input.txt"), "utf8");
const hint = "msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel";
const lines = (text: string) => splitLines(parseAnsi(text));
const mirror = (text: string) => hermesAdapter.buildBlocks(lines(text)).flatMap((b) => b.lines.map(lineText)).join("\n");

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

  it("leaves incomplete working footers and special-state prompts in the mirror", () => {
    for (const text of [
      working.trimEnd().split("\n").slice(0, -1).join("\n"),
      `${working}\nEnter to approve`,
      working.replace("⚕ ❯ ", "⚠ ❯ "),
      working.replace("⚕ ❯ ", "🔒 ❯ "),
    ]) {
      expect(hermesAdapter.extractStatusLines(lines(text))).toEqual([]);
      expect(mirror(text)).toContain(hint);
    }
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
