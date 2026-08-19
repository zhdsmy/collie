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

  it.each([
    [["  tab to queue message", "26% context left"]],
    [["  tab to queue message     26% context left"]],
  ])("recognises Codex's active queue footer across %s", (footer) => {
    const composer = composerBuffer("纯文字输入也报错");
    const captured = [...composer.slice(0, -1), ...lines(footer.join("\n"))];

    expect(stripChrome(captured).map(lineText)).toEqual(["earlier output"]);
    expect(extractStatusLines(captured).map(lineText)).toEqual(footer);
    expect(extractInputDraft(captured)).toBe("纯文字输入也报错");
  });

  it("does not surface Codex's dim rotating placeholder as a draft", () => {
    expect(extractInputDraft(composerBuffer("Explain this codebase", { dim: true }))).toBeNull();
  });

  it("keeps Codex's final completion summary on one line and removes its decorative rows", () => {
    const summary = "─ Worked for 14m 04s";
    const composer = composerBuffer("");
    const captured = [
      ...lines(
        `earlier output\n\x1b[2;37m${summary}\x1b[0m\n${"─".repeat(120)}\n${"─".repeat(80)}`,
      ),
      ...composer.slice(1),
    ];
    const block = codexBuildBlocks(captured)[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual(["earlier output", summary]);
    expect(block.lines.at(-1)!.noWrap).toBe(true);
    expect(block.lines.at(-1)!.segments).toEqual(captured[1]!.segments);
  });

  it("normalizes every completion summary without changing surrounding output", () => {
    const firstSummary = "─ Worked for 1m 02s";
    const secondSummary = "──── Worked for 35s";
    const decorativeRule = "─".repeat(120);
    const unrelatedRule = "─".repeat(80);
    const captured = lines(
      [
        "first query",
        `\x1b[2;37m${firstSummary}\x1b[0m`,
        decorativeRule,
        decorativeRule,
        "first answer",
        "ordinary prose Worked for this example",
        unrelatedRule,
        "second query",
        `\x1b[2;37m${secondSummary}\x1b[0m`,
        "second answer",
      ].join("\n"),
    );
    const block = codexBuildBlocks(captured)[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual([
      "first query",
      firstSummary,
      "first answer",
      "ordinary prose Worked for this example",
      unrelatedRule,
      "second query",
      secondSummary,
      "second answer",
    ]);
    expect(block.lines.filter((line) => lineText(line).includes("Worked for"))).toEqual([
      expect.objectContaining({ noWrap: true }),
      expect.not.objectContaining({ noWrap: true }),
      expect.objectContaining({ noWrap: true }),
    ]);
  });

  it("does not remove unrelated terminal rules", () => {
    const rule = "─".repeat(80);
    const composer = composerBuffer("");
    const captured = [...lines(`test output\n${rule}`), ...composer.slice(1)];
    const block = codexBuildBlocks(captured)[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual(["test output", rule]);
  });

  it("does not rewrite plain terminal output that resembles a completion summary", () => {
    const summary = "─ Worked for demo";
    const rule = "─".repeat(80);
    const block = codexBuildBlocks(lines(`tool output\n${summary}\n${rule}\nreal output`))[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual(["tool output", summary, rule, "real output"]);
    expect(block.lines[1]!.noWrap).toBeUndefined();
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
  const upload = "/test-state/uploads/example.jpg";

  it("accepts Codex image placeholders when their count and caption match", () => {
    expect(imageDraftCarriesSend(`${upload}\n\n请比较这张截图`, "[Image #1]\n\n请比较这张截图")).toBe(true);

    const second = "/alternate-state/uploads/second.png";
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
        `${upload} 请检查终端布局是否正常`,
        "[Image #1] 请检查终端 布局是否正常",
      ),
    ).toBe(true);
  });

  it("accepts a partially converted, windowed multi-image draft", () => {
    const second = "/test-state/uploads/second.png";
    const third = "/test-state/uploads/third.jpg";
    const question = "请比较这些截图中的布局差异";
    const sent = `${upload} ${second}\n前两张是对照样本\n${third}\n${question}`;

    expect(imageDraftCarriesSend(sent, `${upload} [Image #1] 前两张是对照样本 ${question}`)).toBe(
      true,
    );
    expect(imageDraftCarriesSend(sent, `[Image #1] ${question}`)).toBe(true);
  });

  it("rejects mismatched tokens, captions, and ambiguous image-only drafts", () => {
    expect(imageDraftCarriesSend(`${upload} 请检查终端布局是否正常`, "请检查终端布局是否正常")).toBe(false);
    expect(imageDraftCarriesSend(`${upload} 请检查终端布局是否正常`, "[Image #1] 请删除终端里的所有内容")).toBe(
      false,
    );
    expect(imageDraftCarriesSend(upload, "[Image #1]")).toBe(false);
    expect(imageDraftCarriesSend("请检查终端布局是否正常", "[Image #1] 请检查终端布局是否正常")).toBe(false);
    expect(imageDraftCarriesSend(`${upload} echo a b`, "[Image #1] echo ab")).toBe(false);
    const second = "/test-state/uploads/second.png";
    expect(
      imageDraftCarriesSend(
        `${upload} ${second} 请检查终端布局是否正常`,
        "/other-state/uploads/not-this-send.png [Image #1] 请检查终端布局是否正常",
      ),
    ).toBe(false);
    expect(
      imageDraftCarriesSend(
        `${upload} ${second} 请检查终端布局是否正常`,
        "[Image #1] [Image #2] [Image #3] 请检查终端布局是否正常",
      ),
    ).toBe(false);
    expect(imageDraftCarriesSend(`${upload} 请看截图`, "[Image #1] 截图")).toBe(false);
  });
});
