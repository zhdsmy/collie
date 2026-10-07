import { describe, expect, it } from "vitest";

import { parseAnsi } from "./ansi";
import { splitLines } from "./blocks";
import type { TranscriptEntry } from "./types";
import { foldSource, NO_JOINS, planJoins, proseSource } from "./wrap-join";

// The screens below keep the shape of real captures from 2026-10-02 (a Claude pane at 141 columns,
// a Codex pane wrapping Chinese): a hanging indent under a bullet, a word the terminal cut in two,
// and a Codex command cell continued on a `│` row. Shortened to the rows each case is about.

const lines = (screen: string) => splitLines(parseAnsi(screen));
const plan = (screen: string, source: string) => planJoins(lines(screen), foldSource(source));

describe("planJoins", () => {
  it("joins a Claude bullet's hanging-indent rows and keeps the breaks the author wrote", () => {
    const screen = [
      "⏺ Conventions you'll hit",
      "  - Versioning is enforced. The version lives in herdr-plugin.toml, package.json and web/package.json, and must",
      "    match the newest numbered CHANGELOG heading.",
      "  - Fork delivery: you commit, push main, push an annotated tag, then deploy to the local Herdr-managed install at",
      "    ~/.local/share/collie and restart.",
    ].join("\n");
    const source = [
      "## Conventions you'll hit",
      "",
      "- **Versioning is enforced.** The version lives in `herdr-plugin.toml`, `package.json` and `web/package.json`, and must match the newest numbered CHANGELOG heading.",
      "- **Fork delivery:** you commit, push `main`, push an annotated tag, then deploy to the local Herdr-managed install at `~/.local/share/collie` and restart.",
    ].join("\n");
    const joins = plan(screen, source);
    expect([...joins.keys()]).toEqual([2, 4]);
    expect(joins.get(2)).toEqual({ indent: 4, trail: 0, space: true });
    expect(joins.get(4)).toEqual({ indent: 4, trail: 0, space: true });
  });

  it("joins a word the terminal cut in two with nothing between the halves", () => {
    const screen = [
      "    terminal's scrollback. Other parts handle push notifications and optional speech-to-te",
      "xt.",
      "  - Web (web/, Vite + React): the dashboard lists agents that need input first.",
    ].join("\n");
    const source =
      "terminal's scrollback. Other parts handle push notifications and optional speech-to-text.\n- **Web** (`web/`, Vite + React): the dashboard lists agents that need input first.";
    const joins = plan(screen, source);
    expect([...joins.keys()]).toEqual([1]);
    expect(joins.get(1)).toEqual({ indent: 0, trail: 0, space: false });
  });

  it("joins Chinese prose, with a space only where the log had one", () => {
    const screen = [
      "• 代理终端按自身宽度折断的行，只要会话日志能",
      "  证明是折行，就重新合并到 PR、CI 和",
      "  v0.2.0 发布流程。",
    ].join("\n");
    const source = "代理终端按自身宽度折断的行，只要会话日志能证明是折行，就重新合并到 PR、CI 和 v0.2.0 发布流程。";
    const joins = plan(screen, source);
    expect(joins.get(1)).toEqual({ indent: 2, trail: 0, space: false });
    expect(joins.get(2)).toEqual({ indent: 2, trail: 0, space: true });
  });

  it("joins a reply's short last row, and the probe stops at the blank row under it", () => {
    // 2026-10-07, a Claude pane: "rule." folds to four characters, and past the blank row lies the
    // turn's own chrome, which no log holds.
    const screen = [
      "  - The Plan-to-implement path and the other /review pages (choosing a branch or commit) weren't pressed live on 0.160. Their older captures match the same",
      "    rule.",
      "",
      "✻ Cooked for 26m 40s · done Tuesday 11:16 PM",
    ].join("\n");
    const source =
      "- The Plan-to-implement path and the other `/review` pages (choosing a branch or commit) weren't pressed live on 0.160. Their older captures match the same rule.";
    const joins = plan(screen, source);
    expect([...joins.keys()]).toEqual([1]);
    expect(joins.get(1)).toEqual({ indent: 4, trail: 0, space: true });
  });

  it("hides the trailing blanks of the row above a join", () => {
    const joins = plan(
      "  the version lives in three files and must   \n    match the newest numbered heading here",
      "the version lives in three files and must match the newest numbered heading here",
    );
    expect(joins.get(1)).toEqual({ indent: 4, trail: 3, space: true });
  });

  it("never joins a Codex command cell's continuation row, even when the prose says the same words", () => {
    const screen = [
      '• Ran git commit -m "docs(readme): default to English',
      '  │ and showcase localized app screenshots"',
    ].join("\n");
    const source = "I committed docs(readme): default to English and showcase localized app screenshots today.";
    expect(plan(screen, source)).toBe(NO_JOINS);
  });

  it("leaves rows the log does not hold exactly as drawn", () => {
    const screen = "  ⎿  removed: .deploy-v1153-c2-i6got428-previous\n     http://127.0.0.1:8788/build-info.json OK";
    expect(plan(screen, "Deployed and verified the build on both access paths.")).toBe(NO_JOINS);
  });

  it("keeps a break the author wrote inside a paragraph", () => {
    const joins = plan(
      "  the first line of the little poem goes here\n  and the second line continues the poem",
      "the first line of the little poem goes here\nand the second line continues the poem",
    );
    expect(joins).toBe(NO_JOINS);
  });

  it("refuses a probe the log holds twice with different breaks", () => {
    const joins = plan(
      "  the version lives in three files and\n    must match the newest numbered heading",
      "the version lives in three files and must match the newest numbered heading\n\nthe version lives in three files and\nmust match the newest numbered heading",
    );
    expect(joins).toBe(NO_JOINS);
  });

  it("never reaches into a row the caller skips", () => {
    const joins = planJoins(
      lines("  the version lives in three files and must\n    match the newest numbered heading here"),
      foldSource("the version lives in three files and must match the newest numbered heading here"),
      (row) => row === 1,
    );
    expect(joins).toBe(NO_JOINS);
  });

  it("does nothing without a source", () => {
    expect(plan("  some prose that wraps here and\n    continues on the next row", "")).toBe(NO_JOINS);
  });
});

describe("proseSource", () => {
  const entry = (role: TranscriptEntry["role"], parts: TranscriptEntry["parts"]): TranscriptEntry => ({
    uuid: `${role}-${parts.length}`,
    ts: "2026-10-02T00:00:00Z",
    role,
    parts,
  });

  it("keeps what the agent said and drops tool calls, user turns and abandoned branches", () => {
    const rewound = entry("assistant", [{ kind: "text", text: "rewound" }]);
    rewound.abandoned = true;
    const source = proseSource([
      entry("user", [{ kind: "text", text: "describe it" }]),
      entry("assistant", [
        { kind: "thinking", text: "plan" },
        { kind: "tool", name: "Bash", summary: "ls" },
        { kind: "text", text: "It is a phone UI." },
      ]),
      rewound,
    ]);
    expect(source).toBe("plan\n\nIt is a phone UI.");
  });
});
