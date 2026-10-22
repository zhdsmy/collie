import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { buildBlocks } from "../index";
import { agyAdapter, antigravityAdapter } from "./index";
import { menusEqual, menusSameIdentity } from "../menu-model";
import { detectModelRegion } from "./model";

const capture = (width: number) => readFileSync(join(import.meta.dirname,
  "../../../fixtures/panes", `agy--v144-model--w${width}.txt`), "utf8");
const linesOf = (text: string) => splitLines(parseAnsi(text));

describe("AGY native model menu", () => {
  it.each([119, 50])("lifts the native %i-column menu without an unread card", (width) => {
    const lines = linesOf(capture(width));
    const region = detectModelRegion(lines)!;
    expect(region.model.title).toBe("Switch Model");
    expect(region.model.nav).toEqual({ upDown: true, leftRight: { verb: "Effort", label: "medium" } });
    expect(region.model.actions).toEqual([
      { label: "Select", keys: ["Enter"] },
      ...(width === 119 ? [{ label: "Go back", keys: ["Escape"], cancel: true }] : []),
    ]);
    for (const adapter of [agyAdapter, antigravityAdapter]) {
      expect(adapter.buildBlocks(lines).map((block) => block.kind)).toEqual(["menu"]);
      expect(adapter.composerReady!(lines)).toBe(false);
      expect(buildBlocks(lines, { agent: adapter.agent }).some((block) => block.kind === "unread-dialog")).toBe(false);
    }
    const modelFirst = linesOf(capture(width).replace(/auto {2}idle {2}(Gemini 4 Argon \([^)]+\))/, "$1  auto  idle"));
    expect(detectModelRegion(modelFirst)?.model.title).toBe("Switch Model");
  });

  it("keeps navigation identity but changes the commit signature when the highlight moves", () => {
    const original = capture(119);
    const moved = original.replace("> Gemini", "  Gemini").replace("  Gemini 3.8", "> Gemini 3.8");
    const a = detectModelRegion(linesOf(original))!.model;
    const b = detectModelRegion(linesOf(moved))!.model;
    expect(menusSameIdentity(a, b)).toBe(true);
    expect(menusEqual(a, b)).toBe(false);
  });

  it.each([
    (text: string) => text.replace("Switch Model", "Transcript"),
    (text: string) => text.replace("Search:", "Unknown:"),
    (text: string) => text.replace("> Gemini", "  Gemini"),
    (text: string) => text.replace("enter Select", "enter Delete"),
    (text: string) => text + "\nPress Y to confirm\n",
    (text: string) => text + "\n● Wrote the file\n  ⎿ done\n",
  ])("refuses incomplete or covered menus", (mutate) => {
    const plain = linesOf(capture(119)).map(lineText).join("\n");
    expect(detectModelRegion(linesOf(mutate(plain)))).toBeNull();
  });

  it("does not invent an effort control if its active paint is missing", () => {
    const plain = linesOf(capture(119)).map((line) => ({ segments: parseAnsi(line.segments.map((s) => s.text).join("")) }));
    expect(detectModelRegion(plain)!.model.nav.leftRight).toBeUndefined();
  });
});
