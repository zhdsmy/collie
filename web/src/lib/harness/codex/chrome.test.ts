import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { adapterFor, hasBlockGrammar } from "../registry";
import { extractInputDraft, extractStatusLines, hasComposer, stripChrome } from "./chrome";
import {
  codexAdapter,
  codexBuildBlocks,
  compactCodexStatusLines,
  imageDraftCarriesSend,
} from ".";

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

function backgroundlessComposerBuffer(draft: string, continuation: string[] = []): StyledLine[] {
  const prompt = `\x1b[1m›\x1b[0m ${draft}`;
  const status =
    "  \x1b[38;2;246;226;183mgpt-5.6-sol xhigh\x1b[0m\x1b[2m · \x1b[0m" +
    "\x1b[38;2;171;223;167m~/Documents/GitHub/zhdsmy/collie\x1b[0m\x1b[2m · \x1b[0m" +
    "\x1b[38;2;200;169;238mReady\x1b[0m\x1b[2m · \x1b[0m" +
    "\x1b[38;2;242;181;144mContext 100…\x1b[0m";
  return lines(["earlier output", " ", prompt, ...continuation, " ", status].join("\n"));
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

  it("strips the captured macOS 0.148 borderless composer with clipped context", () => {
    const captured = lines(
      `earlier output\n \n${fixture("codex--backgroundless-working-tail.ansi.b64")}`,
    );

    expect(stripChrome(captured).map(lineText)).toEqual(["earlier output"]);
    expect(extractStatusLines(captured).map(lineText)).toEqual([
      expect.stringContaining("Context 6…"),
    ]);
    expect(hasComposer(captured)).toBe(true);
    expect(extractInputDraft(captured)).toBeNull();
  });

  it("compacts Codex status labels without changing their ANSI styling", () => {
    const captured = lines(
      "  " +
        "\x1b[38;2;246;226;183mgpt-5.6-sol xhigh\x1b[0m\x1b[2m · \x1b[0m" +
        "\x1b[38;2;242;181;144mContext 19% left\x1b[0m\x1b[2m · \x1b[0m" +
        "\x1b[38;2;200;169;238mApprove for me\x1b[0m\x1b[2m · \x1b[0m" +
        "\x1b[38;2;171;223;167mFast off\x1b[0m",
    );
    const compacted = compactCodexStatusLines(captured);

    expect(lineText(compacted[0]!)).toBe("  gpt-5.6-sol xhigh· Ctx 19%· Approve· Fast:off");
    expect(compacted[0]!.segments.find((segment) => segment.text === "Ctx 19%")?.fg).toBe(
      "rgb(242,181,144)",
    );
    expect(compacted[0]!.segments.find((segment) => segment.text.startsWith("·"))?.dim).toBe(true);
    expect(lineText(captured[0]!)).toContain("Context 19% left");
    expect(lineText(captured[0]!)).toContain("Approve for me");
  });

  it("compacts every Codex goal label while preserving useful usage details", () => {
    const captured = lines(
      [
        "Pursuing goal (4K / 5K)",
        "Goal paused (/goal resume)",
        "Goal stalled (/goal resume)",
        "Goal hit usage limits (/goal resume)",
        "Goal unmet (51K / 50K tokens)",
        "Goal abandoned",
        "Goal achieved (10h 12m)",
      ].join(" · "),
    );

    expect(lineText(compactCodexStatusLines(captured)[0]!)).toBe(
      "Goal:active (4K / 5K)· Goal:paused· Goal:blocked· Goal:usage· " +
        "Goal:budget (51K / 50K tokens)· Goal:abandoned· Goal:done (10h 12m)",
    );
  });

  it("keeps every Codex status item visible when the terminal wraps the statusline", () => {
    const captured = lines(
      [
        "earlier output",
        " ",
        "\x1b[1m›\x1b[0m Ask Codex to do anything",
        " ",
        "\x1b[38;2;246;226;183mgpt-5.6-sol xhigh\x1b[0m\x1b[2m · \x1b[0m" +
          "\x1b[38;2;171;223;167m~/Documents/GitHub/zhdsmy/collie\x1b[0m",
        "\x1b[2m· \x1b[0m" +
          "\x1b[38;2;200;169;238mReady\x1b[0m\x1b[2m · \x1b[0m" +
          "\x1b[38;2;200;169;238mApprove for me\x1b[0m\x1b[2m · \x1b[0m" +
          "\x1b[38;2;242;181;144mContext 100% left\x1b[0m\x1b[2m · \x1b[0m" +
          "\x1b[38;2;171;223;167mFast off\x1b[0m",
      ].join("\n"),
    );

    expect(extractStatusLines(captured).map(lineText)).toEqual([
      expect.stringContaining("gpt-5.6-sol xhigh"),
      expect.stringContaining("Context 100% left"),
    ]);
    expect(stripChrome(captured).map(lineText)).toEqual(["earlier output"]);
  });

  it("leaves already-compact model, cwd, state, and task items readable", () => {
    const captured = lines(`gpt-5.6-sol max · ~/project · Ready · Tasks 3/3 · Context 100% left`);
    const compacted = compactCodexStatusLines(captured);

    expect(lineText(compacted[0]!)).toBe("gpt-5.6-sol max· ~/project· Ready· Tasks 3/3· Ctx 100%");
  });

  it("extracts a typed draft and joins wrapped composer rows", () => {
    expect(extractInputDraft(composerBuffer("修复", { continuation: ["这个问题"] }))).toBe(
      "修复 这个问题",
    );
  });

  it("extracts a wrapped draft from the borderless macOS composer", () => {
    const captured = backgroundlessComposerBuffer("修复", ["这个问题"]);

    expect(extractInputDraft(captured)).toBe("修复 这个问题");
    expect(hasComposer(captured)).toBe(true);
    expect(stripChrome(captured).map(lineText)).toEqual(["earlier output"]);
  });

  it("recognises a complete slash command while Codex 0.149 shows its suggestion", () => {
    const captured = lines(`earlier output\n${fixture("codex--slash-command-suggestion.ansi.b64")}`);

    expect(hasComposer(captured)).toBe(true);
    expect(extractInputDraft(captured)).toBe("/diff");
    expect(extractStatusLines(captured)).toEqual([]);
    expect(stripChrome(captured).map(lineText)).toEqual(["earlier output"]);
  });

  it("recognises a complete slash command among multiple Codex suggestions", () => {
    const captured = lines(
      [
        "earlier output",
        " ",
        "\x1b[1m›\x1b[0m /status",
        " ",
        "  \x1b[38;2;6;182;212m/status     show current session configuration and token usage\x1b[0m",
        "  \x1b[38;2;6;182;212m/statusline configure items that appear in the status line\x1b[0m",
        "  \x1b[38;2;6;182;212m/skills     list available skills\x1b[0m",
        "  \x1b[38;2;6;182;212m/settings   open settings\x1b[0m",
        "  \x1b[38;2;6;182;212m/stats      show usage statistics\x1b[0m",
      ].join("\n"),
    );

    expect(hasComposer(captured)).toBe(true);
    expect(extractInputDraft(captured)).toBe("/status");
    expect(extractStatusLines(captured)).toEqual([]);
    expect(stripChrome(captured).map(lineText)).toEqual(["earlier output"]);
  });

  it("rejects multiple slash suggestions when none exactly matches the draft", () => {
    const captured = lines(
      [
        "earlier output",
        " ",
        "\x1b[1m›\x1b[0m /status",
        " ",
        "  \x1b[38;2;6;182;212m/statusline configure items that appear in the status line\x1b[0m",
        "  \x1b[38;2;6;182;212m/stats     show usage statistics\x1b[0m",
        "  \x1b[38;2;6;182;212m/skills    list available skills\x1b[0m",
        "  \x1b[38;2;6;182;212m/settings  open settings\x1b[0m",
        "  \x1b[38;2;6;182;212m/resume    open session picker\x1b[0m",
      ].join("\n"),
    );

    expect(hasComposer(captured)).toBe(false);
    expect(extractInputDraft(captured)).toBeNull();
    expect(stripChrome(captured)).toBe(captured);
  });

  it("rejects a slash autocomplete tail containing a malformed row", () => {
    const captured = lines(
      [
        "earlier output",
        " ",
        "\x1b[1m›\x1b[0m /status",
        " ",
        "  \x1b[38;2;6;182;212m/status show current session configuration\x1b[0m",
        "  \x1b[38;2;6;182;212mnot a slash suggestion\x1b[0m",
        "  \x1b[38;2;6;182;212m/statusline configure status line items\x1b[0m",
      ].join("\n"),
    );

    expect(hasComposer(captured)).toBe(false);
    expect(extractInputDraft(captured)).toBeNull();
    expect(stripChrome(captured)).toBe(captured);
  });

  it("does not treat an unrelated coloured tail as Codex slash autocomplete", () => {
    const composer = fixture("codex--slash-command-suggestion.ansi.b64");
    const unrelated = composer.replace(
      "/diff   show git diff (including untracked files)",
      "/status   unrelated command",
    );
    const captured = lines(`earlier output\n${unrelated}`);

    expect(hasComposer(captured)).toBe(false);
    expect(extractInputDraft(captured)).toBeNull();
    expect(stripChrome(captured)).toBe(captured);
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

  it("reflows Codex answer continuations without joining tools, lists, or code", () => {
    const captured = lines(
      [
        "• 我会把修复限制在 Codex 对命令草稿的识",
        "  别，不放宽通用 Enter 安全门。",
        "",
        "• This explanation ends with one",
        "  more word after the terminal wraps it.",
        "",
        "• Running a deliberately long command",
        "  must stay on its own terminal row",
        "",
        "• 下面保留列表：",
        "  - first item",
        "  - second item",
        "\x1b[42m+const longLine = true;\x1b[0m",
        "\x1b[42m  continued code\x1b[0m",
      ].join("\n"),
    );

    const block = codexBuildBlocks(captured)[0]!;
    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual([
      "• 我会把修复限制在 Codex 对命令草稿的识别，不放宽通用 Enter 安全门。",
      "",
      "• This explanation ends with one more word after the terminal wraps it.",
      "",
      "• Running a deliberately long command",
      "  must stay on its own terminal row",
      "",
      "• 下面保留列表：",
      "  - first item",
      "  - second item",
      "+const longLine = true;",
      "  continued code",
    ]);
    expect(block.lines.at(-1)!.segments).toEqual(captured.at(-1)!.segments);
  });

  it("removes Codex 0.149 command-boundary rules and their single-glyph residue", () => {
    const commandSummary = "• Ran 4 commands · ctrl + t to view transcript";
    const longRule = "─".repeat(133);
    const captured = lines(
      [
        "command output",
        commandSummary,
        "",
        `\x1b[2;37m${longRule}\x1b[0m`,
        "",
        "\x1b[2;37m─\x1b[0m",
        "",
        "following answer",
      ].join("\n"),
    );
    const block = codexBuildBlocks(captured)[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual([
      "command output",
      commandSummary,
      "",
      "",
      "",
      "following answer",
    ]);
  });

  it("keeps dim terminal rules when no command summary precedes them", () => {
    const rule = "─".repeat(133);
    const block = codexBuildBlocks(
      lines(`terminal output\n\x1b[2;37m${rule}\x1b[0m\nmore output`),
    )[0]!;

    if (block.kind !== "raw") throw new Error("expected raw Codex block");
    expect(block.lines.map(lineText)).toEqual(["terminal output", rule, "more output"]);
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
    expect(hasComposer(lookalike)).toBe(false);
  });

  it("registers Codex's raw-only block pipeline", () => {
    const captured = lines(`earlier output\n${fixture("codex--idle-tail.ansi.b64")}`);
    expect(adapterFor("codex")).toBe(codexAdapter);
    expect(hasBlockGrammar("codex")).toBe(true);
    expect(codexAdapter.composerReady?.(captured)).toBe(true);
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

  it("accepts two exact upload paths when a long multi-image draft windows out the caption", () => {
    const first = "/Users/michael/.local/state/collie/uploads/w1_p2-mt33qyrc-ff74f768.jpg";
    const second = "/Users/michael/.local/state/collie/uploads/w1_p2-mt33r1ko-bcb0f9ee.jpg";
    const third = "/Users/michael/.local/state/collie/uploads/w1_p2-mt33s7qo-9de56008.png";
    const sent = `${first} ${second}\n正文区中英文换行位置很奇怪\n${third}\n点击 Tab 重命名没有输入框弹出`;

    expect(imageDraftCarriesSend(sent, `${first}\n${second}`)).toBe(true);
    expect(imageDraftCarriesSend(sent, first)).toBe(false);
  });

  it("rejects mismatched tokens, captions, and ambiguous image-only drafts", () => {
    expect(imageDraftCarriesSend(`${upload} 请检查终端布局是否正常`, "请检查终端布局是否正常")).toBe(false);
    expect(imageDraftCarriesSend(`${upload} 请检查终端布局是否正常`, "[Image #1] 请删除终端里的所有内容")).toBe(
      false,
    );
    expect(imageDraftCarriesSend(upload, "[Image #1]")).toBe(false);
    expect(imageDraftCarriesSend(`${upload} ${upload} 请看截图`, `${upload}\n${upload}`)).toBe(false);
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
