import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { codexResumeFrame } from "../../../test/codex-resume-frame";
import { codexAdapter, codexBuildBlocks } from "./index";
import { detectPickerRegion } from "./picker";
import { detectResumeRegion } from "./resume";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const parse = (source: string) => splitLines(parseAnsi(source));
const frame = () => codexResumeFrame("exit");
const model = (source: string) => detectResumeRegion(parse(source))!.model;
const moved = (source: string) => source
  .replace("\x1b[1m› \x1b[22m4d ago", "  4d ago")
  .replace("    5d ago", "  \x1b[1m› \x1b[22m5d ago")
  .replace("1 / 2", "2 / 2");

describe("Codex saved-session picker parsing", () => {
  it.each(["start new", "exit"] as const)("lifts the 0.156.1 %s screen into a card", (exit) => {
    const lines = parse(codexResumeFrame(exit));
    const picker = detectResumeRegion(lines)!.model;
    expect(picker.options.map((option) => option.label)).toEqual([
      "Refactor the picker row formatter",
      "Explain the fixture grammar",
    ]);
    expect(picker.options.map((option) => option.pointed)).toEqual([true, false]);
    expect(codexBuildBlocks(lines)[0]).toMatchObject({ kind: "picker", picker });
    expect(codexAdapter.composerReady!(lines)).toBe(false);
    expect(model(codexResumeFrame(exit, "zz"))).toMatchObject({ query: "zz", options: [] });
    expect(model(codexResumeFrame(exit, "picker", true)).options).toHaveLength(1);
  });

  it("rejects the old combined toolbar and marker", () => {
    expect(detectResumeRegion(parse(frame().replace(
      " Filter:  Cwd  All    Status:  Active  Archived    Sort:  Updated  Created\n\n Type to search",
      " Type to search    Filter:  Cwd  All    Status:  Active  Archived    Sort:  Updated  Created",
    )))).toBeNull();
    expect(detectResumeRegion(parse(frame().replace("› ", "❯ ")))).toBeNull();
  });

  it("keeps native positions distinct when titles match and the window scrolls", () => {
    const duplicate = frame().replace("Explain the fixture grammar", "Refactor the picker row formatter");
    const initial = model(duplicate);
    const next = model(moved(duplicate));
    expect(initial.options.map((option) => option.id)).toEqual(next.options.map((option) => option.id));
    expect(new Set(initial.options.map((option) => option.id)).size).toBe(2);
    expect(next.options.find((option) => option.pointed)?.id).toBe(initial.options[1]!.id);
    const scrolled = parse(moved(duplicate));
    scrolled.splice(6, 1);
    expect(detectResumeRegion(scrolled)!.model.options[0]!.id).toBe(initial.options[1]!.id);
  });

  it.each(["0 / 2", "3 / 2", "1 / 1", "9007199254740992 / 9007199254740993"])(
    "rejects inconsistent native positions: %s", (progress) => {
      expect(detectResumeRegion(parse(frame().replace("1 / 2", progress)))).toBeNull();
    },
  );

  it("reads fork, comfortable rows, and their metadata", () => {
    expect(model(frame().replace("Resume a previous session", "Fork a previous session")))
      .toMatchObject({ identity: "resume:Fork a previous session", sessionAction: "fork" });
    const comfortable = frame()
      .replace("› \x1b[22m4d ago      Refactor", "› \x1b[22mRefactor")
      .replace("    5d ago      Explain", "    Explain")
      .replace(" formatter\n", " formatter\n    4d ago      main\n")
      .replace(" grammar\n", " grammar\n    5d ago      main\n")
      .replace("ctrl+o comfy", "ctrl+o dense");
    expect(model(comfortable).options.map((option) => option.description)).toEqual([
      "4d ago · main", "5d ago · main",
    ]);
  });

  it("refuses torn, expanded, unpainted, and transcript screens", () => {
    const source = frame();
    const lines = parse(source);
    const rule = lines.findIndex((line) => lineText(line).trim().startsWith("──"));
    expect(detectResumeRegion(lines.slice(0, rule))).toBeNull();
    expect(detectResumeRegion(parse(`${source}\nNew output after the picker`))).toBeNull();
    expect(detectResumeRegion(parse(source.replace("Filter:", "Controls:")))).toBeNull();
    expect(detectResumeRegion(parse(source.replace("\x1b[1m›", "\x1b[22m›")))).toBeNull();
    expect(detectResumeRegion(parse(source.replace("› ", "⌄ ")))).toBeNull();
    expect(detectResumeRegion(lines.map((line) => ({
      segments: [{ text: lineText(line), style: {}, muted: false }],
    })))).toBeNull();
  });

  it("keeps other pane captures and model/statusline pickers outside resume", () => {
    for (const file of readdirSync(PANES).filter((name) => name.endsWith(".txt"))) {
      expect(detectResumeRegion(parse(readFileSync(join(PANES, file), "utf8"))), file).toBeNull();
    }
    expect(detectPickerRegion(parse(frame()))).toBeNull();
  });
});
