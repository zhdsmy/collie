import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { codexAdapter } from "./index";
import { stripChrome } from "./chrome";

const prompt = "\x1b[1m› \x1b[2mAsk Codex to do anything\x1b[0m";
const status = "  example-model high · Working · Context 78% left · Fast off · main";
const working = "• Working (2m 16s • esc to interrupt)";
const parse = (text: string) => splitLines(parseAnsi(text));
const screen = (body: string, footer = status, draft = prompt) => parse(`${body}\n\n${draft}\n\n${footer}`);
const statuses = (lines: StyledLine[]) => codexAdapter.extractStatusLines(lines).map(lineText);
function fixture(name: string) {
  return parse(readFileSync(join(import.meta.dirname, "../../../fixtures/panes", name), "utf8"));
}

describe("Codex's live operation hints", () => {
  it("lifts the captured working hint below status and leaves elapsed time in the transcript", () => {
    const lines = fixture("codex--working.txt");
    const before = structuredClone(lines);
    expect(statuses(lines)).toHaveLength(2);
    expect(statuses(lines)[1]).toBe("esc to interrupt");
    const content = stripChrome(lines).map(lineText).join("\n");
    expect(content).toContain("• Working (3s)");
    expect(content).not.toContain("esc to interrupt");
    expect(lines).toEqual(before);
  });

  it.each(["•", "·"])("keeps elapsed time and ANSI styles across the %s separator", (separator) => {
    const line = `\x1b[32m• Working (2m 16s\x1b[2m ${separator} \x1b[33mesc\x1b[36m to interrupt\x1b[32m)\x1b[0m`;
    const lines = screen(line);
    const before = structuredClone(lines);
    const hints = codexAdapter.extractStatusLines(lines);
    expect(hints.map(lineText)).toEqual([status, "esc to interrupt"]);
    expect(hints[1]!.segments.map((s) => [s.text, s.fg, s.dim])).toEqual([
      ["esc", "var(--ansi-3)", true], [" to interrupt", "var(--ansi-6)", true],
    ]);
    const content = stripChrome(lines);
    expect(lineText(content[0]!)).toBe("• Working (2m 16s)");
    expect(content[0]!.segments[0]!.fg).toBe("var(--ansi-2)");
    expect(content[0]!.segments.at(-1)!.text).toBe(")");
    expect(lines).toEqual(before);
  });

  it("separates the captured inline queue hint from its context metric", () => {
    const lines = fixture("codex--queue-context-inline.txt");
    expect(statuses(lines)).toEqual(["93% context left", "Tab to queue message"]);
    expect(codexAdapter.extractInputDraft(lines)).toBe("continue the release checklist");
  });

  it("combines interrupt and queue hints in one optional row without changing the send binding", () => {
    const lines = screen(working, "  tab to queue message\n  50% context left", "› please continue");
    const binding = codexAdapter.composerPrompt!(lines);
    expect(statuses(lines)).toEqual(["  50% context left", "esc to interrupt · tab to queue message"]);
    expect(codexAdapter.extractInputDraft(lines)).toBe("please continue");
    expect(codexAdapter.composerReady!(lines)).toBe(true);
    expect(codexAdapter.composerPrompt!(lines)).toBe(binding);
    expect(binding).toContain("› please continue");
    expect(binding).toContain("tab to queue message");
  });

  it("uses the actual configurable queue key and preserves split ANSI paint", () => {
    const lines = screen(working, "  \x1b[33mCtrl+Q\x1b[2m to queue\x1b[0m    \x1b[32m93% context used\x1b[0m");
    expect(statuses(lines)).toEqual(["93% context used", "esc to interrupt · Ctrl+Q to queue"]);
    const rows = codexAdapter.extractStatusLines(lines);
    expect(rows[0]!.segments[0]!.fg).toBe("var(--ansi-2)");
    expect(rows[1]!.segments.find((s) => s.text === "Ctrl+Q")!.fg).toBe("var(--ansi-3)");
  });

  it.each([
    "codex--fresh-idle.txt", "codex--draft.txt", "codex--draft-wrapped.txt",
    "codex--v0150-idle.txt", "codex--v0151-draft-indented-line.txt",
  ])("does not invent hints on %s", (name) => {
    expect(statuses(fixture(name))).toHaveLength(1);
  });

  it.each([
    "codex--approval-exec.txt", "codex--ask-fruit.txt", "codex--ask-wizard-q1.txt",
    "codex--ask-wizard-q2.txt", "codex--ask-notes-focused.txt", "codex--trust-prompt.txt",
  ])("leaves %s's controls and hints with its dialog", (name) => {
    const lines = fixture(name);
    expect(statuses(lines)).toEqual([]);
    expect(stripChrome(lines)).toBe(lines);
  });

  it.each([
    `${working}\n\n• The response has finished.`,
    `${working}\n  Tool output below the old indicator`,
    "  • Working (2m 16s • esc to interrupt)",
    "• Working (2m 16s • esc to interrupt) and more text",
    "• Working (2m 16s)",
    `${working}\n\n\n`,
  ])("does not lift historical, quoted, unknown, or distant text: %s", (body) => {
    const lines = screen(body);
    expect(statuses(lines)).toEqual([status]);
    expect(stripChrome(lines).map(lineText).join("\n")).toBe(`${body}\n`);
  });

  it("does not lift hint-shaped draft paragraphs or queue text under an ordinary status row", () => {
    const lines = screen("• Previous response", status,
      "\x1b[1m›\x1b[0m [Image #1]\n\n  • Working (2m 16s • esc to interrupt)\n  tab to queue message");
    expect(statuses(lines)).toEqual([status]);
    expect(codexAdapter.extractInputDraft(lines)).toContain("tab to queue message");
  });

  it("does not change a torn frame and drops the optional row on the next completed frame", () => {
    const incomplete = parse(`${working}\n\n${prompt}`);
    expect(statuses(incomplete)).toEqual([]);
    expect(stripChrome(incomplete)).toBe(incomplete);
    expect(statuses(screen(working))).toHaveLength(2);
    const done = screen("• Response complete", status.replace("Working", "Ready"));
    expect(statuses(done)).toEqual([status.replace("Working", "Ready")]);
  });
});
