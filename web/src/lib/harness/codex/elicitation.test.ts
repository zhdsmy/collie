import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { codexAdapter } from "./index";
import { detectElicitationRegion } from "./elicitation";

const capture = (name: string) => readFileSync(new URL(`../../../fixtures/panes/codex--v0162-tool-approval-${name}.txt`, import.meta.url), "utf8");
const parse = (text: string) => splitLines(parseAnsi(text));

describe("Codex MCP tool approval", () => {
  it.each(["open", "session", "once", "narrow"])("lifts %s with permission scopes and app context intact", (name) => {
    const lines = parse(capture(name));
    const model = detectElicitationRegion(lines)!.model;
    expect(model.title).toBe('Allow Computer Use to use "TextEdit"?');
    expect(model.description).toEqual(["App: TextEdit"]);
    expect(model.options.map((option) => option.label)).toEqual(["Allow", "Allow for this session", "Always allow", "Cancel"]);
    expect(model.options.find((option) => option.pointed)?.id).toBe(name === "session" ? "2" : "1");
    expect(model.options[2]!.description).toBe("Run the tool and remember this choice for future tool calls");
    expect(codexAdapter.buildBlocks(lines).at(-1)?.kind).toBe("picker");
    expect(codexAdapter.composerReady?.(lines)).toBe(false);
  });

  it("keeps identity across pointer changes but binds every action to exact displayed content", () => {
    const first = detectElicitationRegion(parse(capture("open")))!.model;
    const next = detectElicitationRegion(parse(capture("session")))!.model;
    expect(next.identity).toBe(first.identity);
    expect(next.signature).not.toBe(first.signature);
    const changed = detectElicitationRegion(parse(capture("open").replaceAll("TextEdit", "Preview")))!.model;
    expect(changed.identity).not.toBe(first.identity);
  });

  it("also recognizes panes that do not report a terminal background", () => {
    const source = capture("open").replace(new RegExp(String.fromCharCode(27) + "\\[48;2;\\d+;\\d+;\\d+m", "g"), "");
    expect(detectElicitationRegion(parse(source))?.model.options).toHaveLength(4);
  });

  it.each([
    ["Field 1/1", "Field 1/2"],
    ["enter", "ctrl+j"],
    ["Always allow", "Always allow and delete files"],
    ["future tool calls", "all applications"],
    ["4. Cancel", "5. Cancel"],
  ])("refuses altered protocol or permission semantics: %s", (from, to) => {
    expect(detectElicitationRegion(parse(capture("open").replace(from, to)))).toBeNull();
  });

  it("refuses incomplete, stale, and plain transcript copies", () => {
    const lines = parse(capture("open"));
    const footer = lines.findIndex((line) => lineText(line).includes("enter to submit"));
    expect(detectElicitationRegion(lines.slice(0, footer))).toBeNull();
    expect(detectElicitationRegion(lines.filter((line) => !lineText(line).includes("4. Cancel")))).toBeNull();
    expect(detectElicitationRegion(parse(capture("open") + "\nNew output"))).toBeNull();
    expect(detectElicitationRegion(parse(lines.map(lineText).join("\n")))).toBeNull();
  });
});
