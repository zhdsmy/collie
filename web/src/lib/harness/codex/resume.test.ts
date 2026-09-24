import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { detectPickerRegion } from "./picker";
import { detectResumeRegion } from "./resume";
import { codexBuildBlocks } from "./index";
import { codexResumeFrame } from "../../../test/codex-resume-frame";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const text = (state: string) => readFileSync(join(PANES, `codex--v0154-resume-${state}.txt`), "utf8");
const parse = (source: string) => splitLines(parseAnsi(source));
const fixture = (state: string) => parse(text(state));
const model = (state: string) => detectResumeRegion(fixture(state))!.model;

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
    const searched = detectResumeRegion(parse(codexResumeFrame(exit, "zz")))!.model;
    expect(searched).toMatchObject({ query: "zz", options: [] });
  });

  it("refuses incomplete or unpainted 0.156.1 screens", () => {
    const frame = codexResumeFrame("exit");
    expect(detectResumeRegion(parse(frame.replace("Filter:", "Controls:")))).toBeNull();
    expect(detectResumeRegion(parse(frame.replace("1 / 2", "3 / 2")))).toBeNull();
    expect(detectResumeRegion(parse(frame.replace("\x1b[1m›", "\x1b[22m›")))).toBeNull();
  });

  it("reads the dense rows, their dates and the native pointer", () => {
    const picker = model("dense");
    expect(picker.title).toBe("Resume a previous session");
    expect(picker.kind).toBe("single");
    expect(picker.sessionAction).toBe("resume");
    expect(picker.query).toBe("");
    expect(picker.options).toEqual([
      {
        id: "1:Refactor the picker row formatter into three small helpers",
        label: "Refactor the picker row formatter into three small helpers",
        description: "4d ago",
        pointed: true,
        current: false,
        checked: false,
        orderable: false,
      },
      {
        id: "2:Explain how the fixture grammar decides a picked row",
        label: "Explain how the fixture grammar decides a picked row",
        description: "5d ago",
        pointed: false,
        current: false,
        checked: false,
        orderable: false,
      },
    ]);
    expect(picker.footer).toContain("↑/↓ browse");
    expect(picker.regionSignature).toContain("Resume a previous session");
  });

  it("follows the pointer without inventing a second one", () => {
    expect(model("dense-moved").options.map((option) => option.pointed)).toEqual([false, true]);
    expect(model("dense-moved").signature).not.toBe(model("dense").signature);
  });

  it("distinguishes identical truncated titles and keeps IDs stable while browsing", () => {
    const duplicate = (state: string) => text(state).replaceAll(
      "Explain how the fixture grammar decides a picked row",
      "Refactor the picker row formatter into three small helpers",
    );
    const initial = detectResumeRegion(parse(duplicate("dense")))!.model;
    const moved = detectResumeRegion(parse(duplicate("dense-moved")))!.model;
    expect(initial.options[0]!.label).toBe(initial.options[1]!.label);
    expect(new Set(initial.options.map((option) => option.id)).size).toBe(2);
    expect(moved.options.map((option) => option.id)).toEqual(initial.options.map((option) => option.id));
    expect(moved.options.find((option) => option.pointed)?.id).toBe(initial.options[1]!.id);

    // Simulate a viewport that scrolls the first row out, retaining the native progress.
    const scrolled = parse(duplicate("dense-moved"));
    scrolled.splice(4, 1);
    expect(detectResumeRegion(scrolled)!.model.options[0]!.id).toBe(initial.options[1]!.id);
  });

  it.each(["0 / 2", "3 / 2", "1 / 1", "9007199254740992 / 9007199254740993"])(
    "refuses inconsistent native row positions: %s", (progress) => {
      expect(detectResumeRegion(parse(text("dense").replace("1 / 2", progress)))).toBeNull();
    },
  );

  it("distinguishes fork presentation without translating the native guard identity", () => {
    const source = text("dense").replace("Resume a previous session", "Fork a previous session");
    const picker = detectResumeRegion(parse(source))!.model;
    expect(picker.sessionAction).toBe("fork");
    expect(picker.identity).toBe("resume:Fork a previous session");
    expect(picker.regionSignature).toContain("Fork a previous session");
  });

  it("keeps every visible row of a longer window, in native order", () => {
    const picker = model("list");
    expect(picker.options.map((option) => option.label)).toEqual([
      "Add a regression test for the empty session list",
      "为什么状态栏在窄屏下换行",
      "Refactor the picker row formatter into three small helpers",
      "Explain how the fixture grammar decides a picked row",
    ]);
    expect(picker.options.map((option) => option.description)).toEqual([
      "2d ago",
      "3d ago",
      "4d ago",
      "5d ago",
    ]);
    expect(picker.options.filter((option) => option.pointed)).toHaveLength(1);
  });

  it("reads the comfortable density's meta row as the row's detail", () => {
    const picker = model("comfortable");
    expect(picker.options.map((option) => option.pointed)).toEqual([false, true]);
    expect(picker.options[1]).toMatchObject({
      label: "Explain how the fixture grammar decides a picked row",
      description: "5d ago · main",
    });
  });

  it("reads the native search field and its empty result", () => {
    const searched = model("search");
    expect(searched.query).toBe("picker");
    expect(searched.options.map((option) => option.label)).toEqual([
      "Refactor the picker row formatter into three small helpers",
    ]);
    const none = model("search-none");
    expect(none.query).toBe("zzz");
    expect(none.options).toEqual([]);
  });

  it("refuses an expanded row, whose detail block is not a row grammar", () => {
    expect(detectResumeRegion(fixture("expanded"))).toBeNull();
  });

  it("does not lift a plain-text transcript that quotes the picker", () => {
    const lines = fixture("dense").map((line) => ({
      segments: [{ text: lineText(line), style: {}, muted: false }],
    }));
    expect(detectResumeRegion(lines)).toBeNull();
  });

  it.each(["dense", "dense-moved", "list", "comfortable", "search", "search-none"])(
    "refuses torn or stale %s screens",
    (state) => {
      const lines = fixture(state);
      const rule = lines.findIndex((line) => lineText(line).trim().startsWith("──"));
      expect(rule).toBeGreaterThan(0);
      // A frame without its progress rule is mid-redraw, not a dialog the card may own.
      expect(detectResumeRegion(lines.slice(0, rule))).toBeNull();
      expect(detectResumeRegion([
        ...lines,
        { segments: [{ text: "New output after the picker", style: {}, muted: false }] },
      ])).toBeNull();
      const withoutTitle = lines.map((line) =>
        lineText(line).trim() === model(state).title ? { segments: [] } : line,
      );
      expect(detectResumeRegion(withoutTitle)).toBeNull();
      // A second pointer, or a duplicated row, is ambiguity the walk must not resolve on its own.
      const doubled = [...lines, ...lines.slice(4, 5)];
      expect(detectResumeRegion(doubled)).toBeNull();
    },
  );

  it("refuses a pointer the renderer did not paint", () => {
    const lines = fixture("dense").map((line) => {
      if (line.segments.every((segment) => !segment.text.includes("❯"))) return line;
      return {
        segments: line.segments.map((segment) =>
          Object.assign({}, segment, { bold: false }),
        ),
      };
    });
    expect(detectResumeRegion(lines)).toBeNull();
  });

  it("leaves every agent fixture outside the resume grammar", () => {
    const others = readdirSync(PANES).filter(
      (name) => name.endsWith(".txt") && !name.startsWith("codex--v0154-resume-"),
    );
    for (const file of others) {
      expect(detectResumeRegion(parse(readFileSync(join(PANES, file), "utf8"))), file).toBeNull();
    }
  });

  it("keeps the model/statusline picker out of the resume screen, and the reverse", () => {
    for (const state of ["dense", "list", "comfortable", "search", "search-none"]) {
      expect(detectPickerRegion(fixture(state))).toBeNull();
    }
    for (const state of ["model", "effort", "advanced", "scope", "statusline"]) {
      const source = readFileSync(join(PANES, `codex--v0154-picker-${state}.txt`), "utf8");
      expect(detectResumeRegion(parse(source))).toBeNull();
    }
  });
});
