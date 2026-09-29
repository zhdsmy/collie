import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { detectAgentsRegion } from "./agents";
import { claudeBuildBlocks } from "./index";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "../../../fixtures/panes", `claude--v21284-agents-${name}.txt`), "utf8");
const parse = (text: string) => splitLines(parseAnsi(text));

describe("Claude left-arrow agents", () => {
  it("lifts the current launcher and preserves earlier conversation", () => {
    const region = detectAgentsRegion(parse(fixture("list")))!;
    expect(region.model).toMatchObject({ title: "Agents", kind: "single", query: null,
      options: [{ label: "Fixture alpha", pointed: true, description: "Needs input · Fixture agent ready for input." }],
      navigation: { order: ["group:Needs input", "session:0", "group:Working", "group:Completed"], id: "session:0" } });
    const blocks = claudeBuildBlocks(parse("Earlier conversation\n" + fixture("list")));
    expect(blocks.map((block) => block.kind)).toEqual(["raw", "picker"]);
    expect(blocks[0]!.lines.map(lineText)).toEqual(["Earlier conversation"]);
    expect(blocks[1]!.lines.map(lineText).join("\n")).toBe(region.model.regionSignature);
  });

  it("keeps native group focus distinct from selectable sessions", () => {
    const first = detectAgentsRegion(parse(fixture("list")))!.model;
    for (const [name, id] of [["header", "group:Needs input"], ["working-header", "group:Working"]]) {
      const model = detectAgentsRegion(parse(fixture(name!)))!.model;
      expect(model.identity).toBe(first.identity);
      expect(model.navigation).toEqual({ order: first.navigation!.order, id });
      expect(model.options[0]!.pointed).toBe(false);
      expect(model.signature).not.toBe(first.signature);
      expect(model.footer).toBe(first.footer);
    }
  });

  it("reads hidden empty groups and repeated truncated titles without losing native positions", () => {
    const opened = detectAgentsRegion(parse(fixture("canary-open")))!.model;
    const moved = detectAgentsRegion(parse(fixture("canary-navigate")))!.model;
    expect(opened.options).toHaveLength(3);
    expect(opened.options[0]!.label).toBe(opened.options[1]!.label);
    expect(opened.navigation).toEqual({ order: ["group:Needs input", "session:0", "session:1", "session:2"], id: "session:0" });
    expect(moved.navigation).toEqual({ order: opened.navigation!.order, id: "session:1" });
    expect(moved.options.filter((option) => option.current).map((option) => option.id)).toEqual(["session:0"]);
    expect(claudeBuildBlocks(parse(fixture("canary-open"))).map((block) => block.kind)).toEqual(["picker"]);
  });

  it("checks the bold title after a leading brand mark", () => {
    const lines = parse(fixture("list"));
    const headerIndex = lines.findIndex((line) => lineText(line).includes("Claude Code v"));
    const header = lines[headerIndex]!;
    const wordmark = header.segments.find((segment) => segment.text.includes("Claude Code"))!;
    const title = lineText(header).trim();
    expect(wordmark.bold).toBe(true);

    lines[headerIndex] = {
      ...header,
      segments: [
        { text: " ▐▛███▛█   ", style: {}, muted: false },
        { ...wordmark, text: title },
      ],
    };
    expect(detectAgentsRegion(lines)).not.toBeNull();

    lines[headerIndex] = {
      ...lines[headerIndex]!,
      segments: [lines[headerIndex]!.segments[0]!, { ...wordmark, text: title, bold: false, style: {} }],
    };
    expect(detectAgentsRegion(lines)).toBeNull();
  });

  it("excludes elapsed ages and spinner paint from action identity", () => {
    const first = detectAgentsRegion(parse(fixture("list")))!.model;
    const later = detectAgentsRegion(parse(fixture("list").replaceAll("2h", "3h").replace("✻", "✽")))!.model;
    expect(later.options).toEqual(first.options);
    expect(later.signature).toBe(first.signature);
    expect(later.regionSignature).not.toBe(first.regionSignature);
  });

  it("refuses draft input, stale output, unknown footers and incomplete or unpainted lists", () => {
    const text = fixture("list");
    for (const changed of [text + "\nNew output", text.replace("escribe a task for a new session", "my draft"),
      text.replace("? for shortcuts", "Esc to close"), text.replace("Working", "Other"),
      text.replace("Claude Code", "Other agent"), text.replace("enter to return", "enter to collapse")]) {
      expect(changed).not.toBe(text);
      expect(detectAgentsRegion(parse(changed))).toBeNull();
    }
    expect(detectAgentsRegion(parse(text).map((line) => ({ segments: [{ text: lineText(line), style: {}, muted: false }] })))).toBeNull();
    const rows = text.split("\n");
    const row = rows.find((line) => line.includes("Fixture alpha"))!;
    rows.splice(rows.indexOf(row), 0, row);
    expect(detectAgentsRegion(parse(rows.join("\n")))).toBeNull();
  });
});
