import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { codexAdapter } from "./index";
import { stripChrome } from "./chrome";

function fixture(name: string) {
  return splitLines(parseAnsi(readFileSync(join(import.meta.dirname, "../../../fixtures/panes", name), "utf8")));
}

describe("Codex without a separate operation-hint strip", () => {
  it.each([
    "codex--working.txt",
    "codex--queue-context-inline.txt",
    "codex--fresh-idle.txt",
    "codex--draft.txt",
    "codex--draft-wrapped.txt",
    "codex--v0150-idle.txt",
    "codex--v0151-draft-indented-line.txt",
  ])("keeps one native status row in %s", (name) => {
    expect(codexAdapter.extractStatusLines(fixture(name))).toHaveLength(1);
  });

  it("preserves the complete Working indicator and its ANSI paint in the transcript", () => {
    const lines = fixture("codex--working.txt");
    const working = lines.find((line) => lineText(line).includes("esc to interrupt"))!;
    const before = structuredClone(lines);
    expect(stripChrome(lines)).toContain(working);
    expect(lineText(working)).toContain("• Working (3s • esc to interrupt)");
    expect(codexAdapter.extractStatusLines(lines).map(lineText).join("\n")).not.toContain("esc to interrupt");
    expect(lines).toEqual(before);
  });

  it("keeps queue hints in the original footer without changing draft or send binding", () => {
    const lines = fixture("codex--queue-context-inline.txt");
    const binding = codexAdapter.composerPrompt!(lines);
    const nativeFooter = lines.find((line) => lineText(line).includes("Tab to queue message"))!;
    expect(lineText(nativeFooter)).toContain("93% context left");
    expect(codexAdapter.extractStatusLines(lines)).toEqual([nativeFooter]);
    expect(codexAdapter.extractInputDraft(lines)).toBe("continue the release checklist");
    expect(codexAdapter.composerReady!(lines)).toBe(true);
    expect(codexAdapter.composerPrompt!(lines)).toBe(binding);
  });

  it.each(["codex--approval-exec.txt", "codex--ask-fruit.txt", "codex--trust-prompt.txt"])(
    "leaves dialogs in control of %s", (name) => {
      expect(codexAdapter.extractStatusLines(fixture(name))).toEqual([]);
    },
  );
});
