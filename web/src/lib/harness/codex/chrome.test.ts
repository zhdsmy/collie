import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { adapterFor, hasBlockGrammar } from "../registry";
import { extractInputDraft, extractStatusLines, stripChrome } from "./chrome";
import { codexAdapter, codexBuildBlocks } from ".";

const PANES_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "panes");
const BACKGROUND = "57;57;71";

function fixture(name: string): string {
  const encoded = readFileSync(join(PANES_DIR, name), "utf8").replace(/\s/g, "");
  return Buffer.from(encoded, "base64").toString("utf8");
}

function lines(text: string): StyledLine[] {
  return splitLines(parseAnsi(text));
}

function painted(text: string, style = ""): string {
  return `\x1b[${style}48;2;${BACKGROUND}m${text}\x1b[0m`;
}

function composerBuffer(
  draft: string,
  options: { dim?: boolean; continuation?: string[]; bottomBackground?: string } = {},
): StyledLine[] {
  const prompt = `${painted("› ", "1;")}${painted(draft, options.dim ? "2;" : "")}${painted(" ".repeat(12))}`;
  const continuation = (options.continuation ?? []).map((row) => painted(row));
  const bottom = `\x1b[48;2;${options.bottomBackground ?? BACKGROUND}m${" ".repeat(20)}\x1b[0m`;
  const status =
    "  \x1b[38;2;246;226;183mgpt-5.6-sol high\x1b[0m · " +
    "\x1b[38;2;200;169;238mReady\x1b[0m · " +
    "\x1b[38;2;242;181;144mContext 91% left\x1b[0m";
  return lines(["earlier output", painted(" ".repeat(20)), prompt, ...continuation, bottom, status].join("\n"));
}

describe("Codex chrome", () => {
  it.each([
    ["codex--working-tail.ansi.b64", "Working", "Context 73% left"],
    ["codex--idle-tail.ansi.b64", "Ready", "Context 100% left"],
  ])("strips the captured %s composer and preserves its styled status", (name, state, context) => {
    const captured = lines(`earlier output\n${fixture(name)}`);
    const stripped = stripChrome(captured);
    const status = extractStatusLines(captured);

    expect(stripped.map(lineText)).toEqual(["earlier output"]);
    expect(status).toHaveLength(1);
    expect(lineText(status[0]!)).toContain(state);
    expect(lineText(status[0]!)).toContain(context);
    expect(status[0]!.segments.some((segment) => segment.fg !== undefined)).toBe(true);
    expect(extractInputDraft(captured)).toBeNull();
  });

  it("extracts a typed draft and joins wrapped composer rows", () => {
    expect(extractInputDraft(composerBuffer("修复", { continuation: ["这个问题"] }))).toBe(
      "修复 这个问题",
    );
  });

  it("does not surface Codex's dim rotating placeholder as a draft", () => {
    expect(extractInputDraft(composerBuffer("Explain this codebase", { dim: true }))).toBeNull();
  });

  it("returns the original buffer when the composer background is torn", () => {
    const torn = composerBuffer("hello", { bottomBackground: "0;0;0" });
    expect(stripChrome(torn)).toBe(torn);
    expect(extractStatusLines(torn)).toEqual([]);
  });

  it("does not strip plain output that merely resembles the prompt and status text", () => {
    const lookalike = lines(
      ["earlier output", " ", "› Explain this codebase", " ", "gpt · Ready · Context 91% left"].join(
        "\n",
      ),
    );
    expect(stripChrome(lookalike)).toBe(lookalike);
  });

  it("registers Codex's raw-only block pipeline", () => {
    const captured = lines(`earlier output\n${fixture("codex--idle-tail.ansi.b64")}`);
    expect(adapterFor("codex")).toBe(codexAdapter);
    expect(hasBlockGrammar("codex")).toBe(true);
    expect(codexBuildBlocks(captured)).toEqual([
      { kind: "raw", lines: [expect.objectContaining({ segments: expect.any(Array) })] },
    ]);
  });
});
