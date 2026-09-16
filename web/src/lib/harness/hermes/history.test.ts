import { describe, expect, it } from "vitest";
import capture from "@/fixtures/panes/hermes--resume-history.txt?raw";
import startup from "@/fixtures/panes/hermes--startup-resume.txt?raw";
import { parseAnsi } from "../../ansi";
import { dropLeadingLines, lineText, splitLines, type RawBlock } from "../../blocks";
import { buildBlocks } from "..";
import { blockOwnsKeyboard } from "../dialog-contract";
import { hermesAdapter } from ".";

const lines = (text: string) => splitLines(parseAnsi(text.trimEnd()));
const blocks = (text: string) => hermesAdapter.buildBlocks(lines(text));
const histories = (text: string) => blocks(text).filter((b): b is RawBlock => b.kind === "raw" && b.sessionInfo?.kind === "history");

describe("Hermes resumed history", () => {
  it("folds startup and welcome without moving their source rows or owning the keyboard", () => {
    const output = blocks(startup);
    const raw = output.filter((b) => b.kind === "raw");
    expect(raw.map((b) => b.sessionInfo?.kind)).toEqual(["startup", "history", "startup-tail"]);
    expect(raw[0]!.sessionInfo).toEqual({ kind: "startup", version: "v0.21.2", tools: 25, skills: 86 });
    expect(raw[1]!.sessionInfo).toEqual({ kind: "history", session: {
      id: "20260916_123456_abcdef1234567890", title: "General", userMessages: 24,
    } });
    expect(output.some(blockOwnsKeyboard)).toBe(false);
    expect(output.flatMap((b) => b.lines)).toHaveLength(lines(startup).length);
    const sourceRows = lines(startup);
    let offset = 0;
    for (const block of raw) {
      if (block.sessionInfo?.kind !== "history") expect(block.lines.map(lineText)).toEqual(sourceRows.slice(offset, offset + block.lines.length).map(lineText));
      offset += block.lines.length;
    }
    expect(lineText(raw[0]!.lines[0]!)).toContain("hermes --resume");
    expect(raw[2]!.lines.map(lineText).join("\n")).toContain("✦ Tip:");
    const withoutStartup = dropLeadingLines(raw, raw[0]!.lines.length);
    expect(withoutStartup[0]!.sessionInfo?.kind).toBe("history");
  });

  it("keeps errors, unknown branding, incomplete frames and unrelated output visible", () => {
    const frameEnd = startup.split("\n").findIndex((row) => lineText(lines(row)[0] ?? { segments: [] }).startsWith("╰"));
    const damaged = startup.split("\n");
    damaged.splice(frameEnd, 1);
    for (const text of [damaged.join("\n"), startup.replace("Hermes Agent v", "Other Agent v"), lines(startup).map(lineText).join("\n")]) {
      expect(blocks(text).some((b) => b.kind === "raw" && b.sessionInfo?.kind === "startup")).toBe(false);
    }
    const warning = "Warning: browser backend unavailable";
    const interrupted = startup.replace("Welcome to Hermes Agent!", `${warning}\nWelcome to Hermes Agent!`);
    const output = blocks(`Earlier session statistics\n${interrupted}\nNew assistant reply`);
    const visible = output.filter((b) => b.kind === "raw" && !b.sessionInfo).flatMap((b) => b.lines.map(lineText)).join("\n");
    expect(visible).toContain("Earlier session statistics");
    expect(visible).toContain(warning);
    expect(visible).toContain("New assistant reply");
    for (const agent of ["codex", "claude", "hermes-custom", undefined]) {
      expect(buildBlocks(lines(startup), { agent }).some((b) => b.kind === "raw" && b.sessionInfo)).toBe(false);
    }
  });
  it("folds the complete native panel without owning the keyboard or changing source row counts", () => {
    const output = blocks(capture);
    expect(histories(capture)).toHaveLength(1);
    expect(output.flatMap((b) => b.lines)).toHaveLength(lines(capture).length);
    expect(output.some(blockOwnsKeyboard)).toBe(false);
    expect(hermesAdapter.displayOnly).toBe(true);
    const body = output.flatMap((b) => b.lines.map(lineText)).join("\n");
    expect(body).toContain("● You:");
    expect(body).toContain("◆ Hermes:");
    expect(body).not.toContain("Previous Conversation");
    expect(body).not.toMatch(/[╭╮╰╯]/u);
    expect(body).toContain("\n\n");
  });

  it("preserves surrounding output and an unfinished repaint instead of swallowing it", () => {
    const rows = capture.trimEnd().split("\n");
    const fragment = rows.slice(0, 4).join("\n");
    const text = `Before history\n${fragment}\n${capture.trimEnd()}\nAfter history`;
    const output = blocks(text);
    expect(histories(text)).toHaveLength(1);
    expect(output[0]!.lines.map(lineText).join("\n")).toContain("Previous Conversation");
    expect(output[0]!.lines.map(lineText)[0]).toBe("Before history");
    expect(output.at(-1)!.lines.map(lineText)).toEqual(["After history"]);
    expect(output.flatMap((b) => b.lines)).toHaveLength(lines(text).length);
  });

  it("leaves cropped, unstyled, unknown, mismatched and broken panels raw", () => {
    const rows = capture.trimEnd().split("\n");
    for (const text of [
      rows.slice(0, -1).join("\n"),
      rows.slice(1).join("\n"),
      lines(capture).map(lineText).join("\n"),
      capture.replace("Previous Conversation", "Ordinary Conversation"),
      [...rows.slice(0, -1), rows.at(-1)!.replace("──", "─")].join("\n"),
      [...rows.slice(0, 3), "This is ordinary terminal output", ...rows.slice(3)].join("\n"),
    ]) expect(histories(text)).toEqual([]);
  });

  it("puts only the adjacent styled resume announcement into history, including wrapped titles", () => {
    const announcement = '\x1b[33m↻ Resumed session \x1b[1m20260916_120000_example\x1b[22m "General\ntasks" (24 user messages, 579 total messages)\x1b[0m';
    const text = `Earlier output\n${announcement}\n${capture}`;
    const history = histories(text)[0]!;
    expect(history.kind === "raw" && history.sessionInfo).toEqual({
      kind: "history", session: { id: "20260916_120000_example", title: "General tasks", userMessages: 24 },
    });
    expect(lineText(history.lines[0]!)).toContain("Resumed session");
    expect(blocks(text).flatMap((b) => b.lines)).toHaveLength(lines(text).length);
    for (const prefix of [
      lines(announcement).map(lineText).join("\n"),
      `${announcement}\nWarning: browser unavailable`,
      announcement.replace("total messages)", "unknown count)"),
    ]) {
      const output = blocks(`${prefix}\n${capture}`);
      expect(output[0]?.kind === "raw" && output[0].sessionInfo).toBeUndefined();
      expect(histories(`${prefix}\n${capture}`)[0]?.sessionInfo).toEqual({ kind: "history" });
    }
  });

  it.each(["claude", "codex", "hermes-custom", undefined])("does not fold the panel for %s", (agent) => {
    expect(buildBlocks(lines(capture), { agent }).some((b) => b.kind === "raw" && b.sessionInfo)).toBe(false);
  });

  it("removes fold metadata when the latest-reply view subtracts part of the history", () => {
    const raw = blocks(capture).filter((b) => b.kind === "raw");
    expect(dropLeadingLines(raw, 0)).toBe(raw);
    const partial = dropLeadingLines(raw, 2);
    expect(partial[0]!.sessionInfo).toBeUndefined();
    expect(partial[0]!.lines).toEqual(raw[0]!.lines.slice(2));
    expect(dropLeadingLines(raw, raw[0]!.lines.length)).toEqual([]);
  });
});
