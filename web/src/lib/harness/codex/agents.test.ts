import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { detectAgentsRegion } from "./agents";
import { codexBuildBlocks } from "./index";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const source = (moved = false) => readFileSync(join(PANES, `codex--v0158-agents-overview${moved ? "-moved" : ""}.txt`), "utf8");
const parse = (text: string) => splitLines(parseAnsi(text));

describe("Codex agent command center", () => {
  it("recognizes the active command center after terminal scrollback", () => {
    const lines = parse("Earlier terminal output\n" + source());
    const region = detectAgentsRegion(lines)!;
    expect(region.startLine).toBe(1);
    expect(region.model).toEqual(detectAgentsRegion(parse(source()))!.model);
    expect(codexBuildBlocks(lines).map((block) => block.kind)).toEqual(["raw", "picker"]);
    expect(detectAgentsRegion(parse(source() + "\nEarlier terminal output"))).toBeNull();
  });

  it("reads the delete shortcut only from the painted native help page", () => {
    const help = readFileSync(join(PANES, "codex--v0158-agents-overview-help.txt"), "utf8");
    expect(detectAgentsRegion(parse(help))!.model).toMatchObject({ identity: "agents:help", deleteKey: "Backspace", options: [] });
    expect(detectAgentsRegion(parse(help.replace("delete  Delete", "d  Delete")))!.model.deleteKey).toBe("d");
    expect(detectAgentsRegion(parse(help.replace("delete  Delete", "delete  Other")))!.model.deleteKey).toBeUndefined();
    expect(detectAgentsRegion(parse(help + "\nNew output"))).toBeNull();
  });

  it("keeps current task separate from focus while the native detail pane changes", () => {
    const first = detectAgentsRegion(parse(source()))!.model;
    const moved = detectAgentsRegion(parse(source(true)))!.model;
    expect(first.options).toHaveLength(2);
    expect(first.options[0]).toMatchObject({ label: "Fixture alpha", current: true, pointed: true });
    expect(moved.options[0]).toMatchObject({ current: true, pointed: false });
    expect(moved.options[1]).toMatchObject({ label: "Fixture beta", pointed: true, current: false });
    expect(moved.options[1]!.description).toContain(" · Error");
    expect(moved.options.map((option) => option.id)).toEqual(first.options.map((option) => option.id));
    expect(moved.identity).toBe(first.identity);
    expect(moved.signature).not.toBe(first.signature);
    expect(moved.query).toBeNull();
    expect(moved.sessionAction).toBeUndefined();
  });

  it("keeps duplicate task names independently addressable by visible order", () => {
    const repeatedName = (text: string) => text.replaceAll("Fixture beta", "Fixture alpha");
    const first = detectAgentsRegion(parse(repeatedName(source())))!.model;
    const moved = detectAgentsRegion(parse(repeatedName(source(true))))!.model;

    expect(first.options.map((option) => option.label)).toEqual(["Fixture alpha", "Fixture alpha"]);
    expect(new Set(first.options.map((option) => option.id)).size).toBe(2);
    expect(moved.options.map((option) => option.id)).toEqual(first.options.map((option) => option.id));
    expect(moved.options.map((option) => option.pointed)).toEqual([false, true]);
  });

  it("refuses missing paint, partial frames, other modes and stale output", () => {
    const lines = parse(source());
    expect(detectAgentsRegion(lines.map((line) => ({ segments: [{ text: lineText(line), style: {}, muted: false }] })))).toBeNull();
    for (const fragment of ["Agent command center", "›", "? help"]) {
      const unpainted = lines.map((line) => lineText(line).includes(fragment)
        ? { segments: line.segments.map((segment) => ({ ...segment, bold: false, dim: false })) } : line);
      expect(detectAgentsRegion(unpainted), fragment).toBeNull();
    }
    expect(detectAgentsRegion(lines.slice(1))).toBeNull();
    expect(detectAgentsRegion(lines.slice(0, -1))).toBeNull();
    expect(detectAgentsRegion(parse(source() + "\nNew output"))).toBeNull();
    expect(detectAgentsRegion(parse(source().replace("    ! Fixture beta", "  › ! Fixture beta")))).toBeNull();
    expect(detectAgentsRegion(parse(source().replace("Group: Project", "Group: Model")))).toBeNull();
    expect(detectAgentsRegion([...lines.slice(0, -1), ...parse("Search: query"), ...lines.slice(-1)])).toBeNull();
    expect(detectAgentsRegion(parse(source().replace("    ! Fixture beta", "Unknown action\n    ! Fixture beta")))).toBeNull();
  });

  it("does not bind changing ages to task identity or navigation facts", () => {
    const before = detectAgentsRegion(parse(source()))!.model;
    const after = detectAgentsRegion(parse(source().replaceAll("3m ago", "4m ago")))!.model;
    expect(after.options).toEqual(before.options);
    expect(after.regionSignature).not.toBe(before.regionSignature);
  });

  it("leaves every other captured interface outside this grammar", () => {
    for (const file of readdirSync(PANES).filter((name) => name.endsWith(".txt") && !name.startsWith("codex--v0158-agents-overview"))) {
      expect(detectAgentsRegion(parse(readFileSync(join(PANES, file), "utf8"))), file).toBeNull();
    }
  });
});
