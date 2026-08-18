import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { adapterFor, hasBlockGrammar } from "../registry";
import { extractInputDraft, extractStatusLines, stripChrome } from "./chrome";
import { codexAdapter, codexBuildBlocks, imageDraftCarriesSend } from ".";

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

  it("keeps Codex's completion summary and removes its trailing decorative rows", () => {
    const summary = "─ Worked for 14m 04s";
    const composer = composerBuffer("");
    const captured = [
      ...lines(`earlier output\n${summary}\n${"─".repeat(120)}\n${"─".repeat(80)}`),
      ...composer.slice(1),
    ];
    const block = codexBuildBlocks(captured)[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual(["earlier output", summary]);
    expect(block.lines.at(-1)!.noWrap).toBe(true);
  });

  it("does not remove unrelated terminal rules", () => {
    const rule = "─".repeat(80);
    const composer = composerBuffer("");
    const captured = [...lines(`test output\n${rule}`), ...composer.slice(1)];
    const block = codexBuildBlocks(captured)[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual(["test output", rule]);
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

describe("Codex image draft verification", () => {
  const upload = "/root/.local/state/collie/uploads/wC_p8-example-1234.jpg";

  it("accepts Codex image placeholders when their count and caption match", () => {
    expect(imageDraftCarriesSend(`${upload}\n\n本来是图片路径`, "[Image #1]\n\n本来是图片路径")).toBe(true);

    const second = "/custom/collie/uploads/wC_p8-second.png";
    expect(
      imageDraftCarriesSend(
        `${upload} ${second} compare these two screenshots carefully`,
        "[Image #1] [Image #2] compare these two screenshots carefully",
      ),
    ).toBe(true);
  });

  it("tolerates only whitespace introduced while the Codex composer wraps", () => {
    expect(
      imageDraftCarriesSend(
        `${upload} 请检查这个终端界面是否正常`,
        "[Image #1] 请检查这个终端 界面是否正常",
      ),
    ).toBe(true);
  });

  it("rejects mismatched tokens, captions, and ambiguous image-only drafts", () => {
    expect(imageDraftCarriesSend(`${upload} 请检查这个终端界面是否正常`, "请检查这个终端界面是否正常")).toBe(false);
    expect(imageDraftCarriesSend(`${upload} 请检查这个终端界面是否正常`, "[Image #1] 请删除这个终端里的所有内容")).toBe(
      false,
    );
    expect(imageDraftCarriesSend(upload, "[Image #1]")).toBe(false);
    expect(imageDraftCarriesSend("请检查这个终端界面是否正常", "[Image #1] 请检查这个终端界面是否正常")).toBe(false);
  });
});
