import { describe, expect, it } from "vitest";
import capture from "@/fixtures/panes/hermes--resume-history.txt?raw";
import fragments from "@/fixtures/panes/hermes--resume-fragments.txt?raw";
import fragmentsRestored from "@/fixtures/panes/hermes--resume-fragments-restored.txt?raw";
import startup from "@/fixtures/panes/hermes--startup-resume.txt?raw";
import { parseAnsi } from "../../ansi";
import { dropLeadingLines, lineText, splitLines, type RawBlock } from "../../blocks";
import { buildBlocks } from "..";
import { blockOwnsKeyboard } from "../dialog-contract";
import { hermesAdapter } from ".";
import { extractHistoryMessages } from "./session-info";
import { displayWidth } from "../../text-width";

const lines = (text: string) => splitLines(parseAnsi(text.trimEnd()));
const blocks = (text: string) => hermesAdapter.buildBlocks(lines(text));
const histories = (text: string) => blocks(text).filter((b): b is RawBlock => b.kind === "raw" && b.sessionInfo?.kind === "history");

describe("Hermes resumed history", () => {
  it("folds the v0.21.3 startup count with MCP servers and preserves semantic fields", () => {
    const newer = startup.replace("v0.21.2", "v0.21.3")
      .replace("86 skills · /help for commands\x1b[0m" + " ".repeat(16),
        "86 skills · 2 MCP servers · /help for commands\x1b[0m");
    expect(newer).toContain("2 MCP servers · /help");
    const output = blocks(newer);
    const card = output.find((block) => block.kind === "raw" && block.sessionInfo?.kind === "startup");
    if (card?.kind !== "raw" || card.sessionInfo?.kind !== "startup") throw new Error("Missing startup");
    expect(card.sessionInfo).toMatchObject({ version: "v0.21.3", tools: 25, skills: 86 });
    expect(card.sessionInfo.details.fields.find((field) => field.label === "model")?.value.text).toBe("deepseek-flash");
    expect(card.sessionInfo.details.groups.find((group) => group.kind === "mcp")?.items).toHaveLength(2);
    expect(output.flatMap((block) => block.lines)).toHaveLength(lines(newer).length);
    expect(card.lines.map(lineText).join("\n")).not.toMatch(/[█╭╰╔]/u);
    const plain = lines(newer).map(lineText).join("\n");
    expect(blocks(plain).some((block) => block.kind === "raw" && block.sessionInfo?.kind === "startup")).toBe(false);
  });

  it("extracts complete startup values and maps every displayed value to searchable text", () => {
    for (const block of blocks(startup)) {
      if (block.kind !== "raw" || !block.sessionInfo) continue;
      const info = block.sessionInfo;
      const text = block.lines.map(lineText).join("\n");
      const values = info.kind === "startup" ? [
        ...info.details.fields.map((field) => field.value),
        ...info.details.groups.flatMap((group) => [
          ...group.items.flatMap((item) => item.detail ? [item.name, item.detail] : [item.name]), ...group.notes,
        ]), ...info.details.notes,
      ] : info.kind === "history" ? info.messages?.map((message) => message.content) ?? [] : info.tips ?? [];
      for (const value of values) expect(text.slice(value.start, value.start + value.text.length)).toBe(value.text);
      if (info.kind !== "startup") continue;
      expect(Object.fromEntries(info.details.fields.map((field) => [field.label, field.value.text]))).toEqual({
        model: "deepseek-flash", provider: "Nous Research", directory: "/Users/example/.hermes",
        session: "20260916_123456_abcdef", build: "v0.21.2 (2026.9.11) · upstream 1021a032",
      });
      expect(info.details.groups.find((group) => group.kind === "mcp")?.items.map((item) => item.name.text)).toEqual(["codegraph", "nezha"]);
      expect(info.details.groups.find((group) => group.kind === "skills")?.items.map((item) => item.name.text)).toContain("data-science");
    }
  });

  it("preserves paragraphs and code indentation while separating native roles and tool activity", () => {
    const input = lines([
      "", "  ● You: 第一段", "         ", "         ", "         第二段",
      "  ◆ Hermes: ## Summary", "            ", "                indented code",
      "            Hermes: this is body text", "            Finished. [2 tool calls: read, search]", "",
    ].join("\n"));
    const result = extractHistoryMessages(input);
    expect(result.lines).toHaveLength(input.length);
    expect(result.messages.map((message) => [message.role, message.content.text])).toEqual([
      ["user", "第一段\n\n\n第二段"],
      ["assistant", "## Summary\n\n    indented code\nHermes: this is body text\nFinished."],
      ["tools", "[2 tool calls: read, search]"],
    ]);
    const text = result.lines.map(lineText).join("\n");
    for (const { content } of result.messages) expect(text.slice(content.start, content.start + content.text.length)).toBe(content.text);
  });

  it("keeps a CJK directory separate from the right-hand skill column", () => {
    const original = "/Users/example/.hermes";
    const directory = "/Users/示例/.hermes";
    const text = startup.replace(original, directory + " ".repeat(displayWidth(original) - displayWidth(directory)));
    const info = blocks(text).find((block) => block.kind === "raw" && block.sessionInfo?.kind === "startup");
    if (info?.kind !== "raw" || info.sessionInfo?.kind !== "startup") throw new Error("Missing startup card");
    expect(info.sessionInfo.details.fields.find((field) => field.label === "directory")?.value.text).toBe(directory);
    expect(info.sessionInfo.details.groups.find((group) => group.kind === "skills")?.items.map((item) => item.name.text)).toContain("creative");
  });

  it("folds startup and welcome without moving their source rows or owning the keyboard", () => {
    const output = blocks(startup);
    const raw = output.filter((b) => b.kind === "raw");
    expect(raw.map((b) => b.sessionInfo?.kind)).toEqual(["startup", "history", "startup-tail"]);
    expect(raw[0]!.sessionInfo).toMatchObject({ kind: "startup", version: "v0.21.2", tools: 25, skills: 86 });
    expect(raw[1]!.sessionInfo).toMatchObject({ kind: "history", session: {
      id: "20260916_123456_abcdef", title: "General", userMessages: 24, totalMessages: 579,
    } });
    expect(output.some(blockOwnsKeyboard)).toBe(false);
    expect(output.flatMap((b) => b.lines)).toHaveLength(lines(startup).length);
    const core = raw[0]!.lines.map(lineText).join("\n");
    expect(core).toContain("deepseek-flash");
    expect(core).not.toMatch(/[█╭╰╔]/u);
    expect(raw[2]!.lines.map(lineText).join("\n")).toContain("/model --global");
    expect(raw[2]!.lines.map(lineText).join("\n")).not.toContain("Welcome to Hermes");
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
    const info = histories(capture)[0]!.sessionInfo;
    if (info?.kind !== "history") throw new Error("Missing history");
    expect(info.messages?.map((message) => message.role)).toContain("user");
    expect(info.messages?.map((message) => message.role)).toContain("assistant");
    expect(body).not.toContain("● You:");
    expect(body).not.toContain("◆ Hermes:");
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
    expect(history.kind === "raw" && history.sessionInfo).toMatchObject({
      kind: "history", session: { id: "20260916_120000_example", title: "General tasks", userMessages: 24, totalMessages: 579 },
    });
    expect(history.lines.map(lineText).join("\n")).not.toContain("Resumed session");
    expect(blocks(text).flatMap((b) => b.lines)).toHaveLength(lines(text).length);
    for (const prefix of [
      lines(announcement).map(lineText).join("\n"),
      `${announcement}\nWarning: browser unavailable`,
      announcement.replace("total messages)", "unknown count)"),
    ]) {
      const output = blocks(`${prefix}\n${capture}`);
      expect(output[0]?.kind === "raw" && output[0].sessionInfo).toBeUndefined();
      expect(histories(`${prefix}\n${capture}`)[0]?.sessionInfo).toMatchObject({ kind: "history" });
      expect(histories(`${prefix}\n${capture}`)[0]?.sessionInfo).not.toHaveProperty("session");
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

  it("absorbs superseded repaint fragments and the model-restored line into the history card", () => {
    for (const text of [fragments, fragmentsRestored]) {
      const output = blocks(text);
      const history = histories(text);
      expect(history).toHaveLength(1);
      const info = history[0]!.sessionInfo;
      if (info?.kind !== "history") throw new Error("Missing history");
      expect(info.messages?.length).toBeGreaterThan(0);
      const body = output.flatMap((b) => b.lines.map(lineText)).join("\n");
      expect(body).not.toContain("● You:");
      expect(body).not.toContain("◆ Hermes:");
      expect(body).not.toContain("Previous Conversation");
      expect(body).not.toContain("Resumed session");
      expect(body).not.toContain("Model restored from session");
      expect(body).not.toMatch(/[╭╮╰╯]/u);
      // These captures include the 4-row footer chrome (statusline, rule, prompt, rule); the
      // renderer owns those rows, so the block stream carries content rows only.
      const footerRows = /❯ /u.test(text.trimEnd().split("\n").at(-2) ?? "") ? 4 : 0;
      expect(output.flatMap((b) => b.lines)).toHaveLength(lines(text).length - footerRows);
      expect(output.some(blockOwnsKeyboard)).toBe(false);
    }
    // The restored variant keeps the announcement metadata despite the interleaved line.
    const info = histories(fragmentsRestored)[0]!.sessionInfo;
    if (info?.kind !== "history") throw new Error("Missing history");
    expect(info.session).toMatchObject({ id: "53593c56_3a463b_1a9f71", title: "General", userMessages: 61, totalMessages: 570 });
    // The plain-fragments capture (no restored line) also resolves its announcement.
    const plain = histories(fragments)[0]!.sessionInfo;
    if (plain?.kind !== "history") throw new Error("Missing history");
    expect(plain.session).toMatchObject({ id: "53593c56_3a463b_1a9f71", title: "General", userMessages: 61, totalMessages: 570 });
  });

  it("absorbs a split repaint header and leaves one earlier-messages notice", () => {
    const rows = fragmentsRestored.trimEnd().split("\n");
    const titles = rows.flatMap((row, index) => row.includes("Previous Conversation") ? [index] : []);
    rows[titles[1]!] = rows[titles[1]!]!.replace("╭", "");
    const output = blocks(rows.join("\n"));
    const history = output.filter((block): block is RawBlock => block.kind === "raw" && block.sessionInfo?.kind === "history");
    expect(history).toHaveLength(1);
    expect(history[0]!.sessionInfo).toMatchObject({ session: { title: "General" } });
    const visible = output.flatMap((block) => block.lines.map(lineText)).join("\n");
    expect(visible).not.toContain("Previous Conversation");
    expect(visible.match(/299 earlier messages/gu)).toHaveLength(1);
    expect(output.flatMap((block) => block.lines)).toHaveLength(lines(rows.join("\n")).length - 4);
  });

  it("folds rewrapped startup and history panels after a pane resize", () => {
    const original = lines(startup);
    const baseline = blocks(startup);
    const slice = (line: (typeof original)[number], start: number, end: number) => {
      let offset = 0;
      return line.segments.flatMap((segment) => {
        const from = Math.max(0, start - offset);
        const to = Math.min(segment.text.length, end - offset);
        offset += segment.text.length;
        return from < to ? [{ ...segment, text: segment.text.slice(from, to) }] : [];
      });
    };
    let panel: "startup" | "history" | null = null;
    let clipped = false;
    const wrapped = original.flatMap((line) => {
      const text = lineText(line);
      if (text.startsWith("╭─") && text.includes("Hermes Agent")) panel = "startup";
      if (text.startsWith("╭─") && text.includes("Previous Conversation")) panel = "history";
      if (!panel || !/^[╭│╰]/u.test(text)) return [line];
      const cut = text.length - 3;
      const first = { ...line, segments: slice(line, 0, cut) };
      const tail = { ...line, segments: slice(line, cut, text.length) };
      const omitTail = panel === "history" && !clipped && text.startsWith("│") && text.endsWith("    │");
      if (omitTail) clipped = true;
      if (text.startsWith("╰")) panel = null;
      return omitTail ? [first] : [first, tail];
    });
    expect(clipped).toBe(true);
    const output = hermesAdapter.buildBlocks(wrapped);
    expect(output.filter((b) => b.kind === "raw").map((b) => b.sessionInfo?.kind)).toEqual(["startup", "history", "startup-tail"]);
    expect(output.flatMap((b) => b.lines)).toHaveLength(wrapped.length);
    const history = output.find((b): b is RawBlock => b.kind === "raw" && b.sessionInfo?.kind === "history");
    const expected = baseline.find((b): b is RawBlock => b.kind === "raw" && b.sessionInfo?.kind === "history");
    expect(history?.sessionInfo).toEqual(expected?.sessionInfo);
    const visible = output.flatMap((b) => b.lines.map(lineText)).join("\n");
    expect(visible).not.toMatch(/Previous Conversation|Resumed session|Hermes Agent v/u);
  });

  it("stops the fragment absorption at unrelated output", () => {
    const rows = fragmentsRestored.trimEnd().split("\n");
    const intruder = "Unrelated warning between repaints";
    const spliced = [...rows.slice(0, 100), intruder, ...rows.slice(100)];
    const text = spliced.join("\n");
    const output = blocks(text);
    const visible = output.filter((b) => b.kind === "raw" && !b.sessionInfo).flatMap((b) => b.lines.map(lineText)).join("\n");
    expect(visible).toContain(intruder);
    expect(histories(text)).toHaveLength(1);
  });
});
