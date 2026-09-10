import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { describeAdapterConformance } from "../conformance";
import { adapterFor } from "../registry";
import { hermesAdapter } from ".";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const capture = readFileSync(join(PANES, "hermes--done.txt"), "utf8");
const lines = (text: string) => splitLines(parseAnsi(text));
const mirror = (text: string) => hermesAdapter.buildBlocks(lines(text)).flatMap((b) => b.lines.map(lineText)).join("\n");

describe("Hermes display chrome", () => {
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
  neutralFixtures: ["hermes--done.txt"],
});
