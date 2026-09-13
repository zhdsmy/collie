import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { codexAdapter } from "./index";
import { normalizeComposerParticles } from "./particles";

const load = (name: string) => readFileSync(join(import.meta.dirname, "../../../fixtures/panes", `codex--v0154-particles-${name}.txt`), "utf8");
const parse = (text: string) => splitLines(parseAnsi(text));

it("recognizes an empty animated composer without a false terminal draft or background rows", () => {
  const lines = parse(load("working"));
  const original = structuredClone(lines);
  expect(codexAdapter.composerReady!(lines)).toBe(true);
  expect(codexAdapter.extractInputDraft(lines)).toBeNull();
  expect(codexAdapter.composerPrompt!(lines)).toBe("› Ask Codex to do anything");
  expect(codexAdapter.extractStatusLines(lines)).toHaveLength(1);
  expect(codexAdapter.buildBlocks(lines).flatMap((b) => b.lines).map(lineText)).toEqual([
    "• Working (3s • esc to interrupt)",
  ]);
  expect(lines).toEqual(original);
});

it("restores animated spaces while preserving typed punctuation, Braille, image tokens and paths", () => {
  const lines = parse(load("draft"));
  expect(codexAdapter.extractInputDraft(lines)).toBe("Probe 你好 . · ⠁⠂ [Image #1] /private/tmp/sample.png");
  const normalized = normalizeComposerParticles(lines);
  expect(normalized.map((line) => lineText(line).length)).toEqual(lines.map((line) => lineText(line).length));
  expect(codexAdapter.composerPrompt!(lines)).toBe("› Probe 你好 . · ⠁⠂ [Image #1] /private/tmp/sample.png");
});

it("recognizes a particle in the space immediately after the live prompt marker", () => {
  const lines = parse(load("working"));
  const row = lines.find((line) => lineText(line).startsWith("›"))!;
  const particle = row.segments.find((s) => /^[⠁⠂⠄⠈⠐⠠⡀⢀]$/u.test(s.text))!;
  row.segments[1] = { ...particle, text: "⠁" };
  expect(codexAdapter.composerReady!(lines)).toBe(true);
  expect(codexAdapter.extractInputDraft(lines)).toBeNull();
});
it("recognizes animated Plan input with a custom footer and its right-aligned mode hint", () => {
  const lines = parse(load("working"));
  const status = lines.findLastIndex((line) => lineText(line).trim() !== "");
  lines[status] = parse("  \u001b[38;2;246;226;183mgpt-6-astra medium\u001b[0m\u001b[2m · \u001b[0m\u001b[38;2;242;181;144mContext 100% left               \u001b[0m\u001b[35mPlan mode (shift+tab to cycle)\u001b[0m")[0]!;
  const marker = lines.find((line) => lineText(line).startsWith("›"))!.segments[0]!;
  marker.fg = "rgb(248,183,90)";
  expect(codexAdapter.composerReady!(lines)).toBe(true);
  expect(codexAdapter.extractInputDraft(lines)).toBeNull();
  expect(codexAdapter.composerPrompt!(lines)).toBe("› Ask Codex to do anything");
  expect(codexAdapter.extractStatusLines(lines)).toHaveLength(1);
});

it.each([
  (text: string) => text + "\nA new dialog owns the screen.\n",
  (text: string) => parse(text).map(lineText).join("\n"),
  (text: string) => text.split("\n").slice(0, -2).join("\n"),
])("does not normalize incomplete, unstyled or non-tail lookalikes", (change) => {
  const lines = parse(change(load("working")));
  expect(normalizeComposerParticles(lines)).toBe(lines);
});

it("does not erase ordinary dim, bold or uncolored Braille", () => {
  const lines = parse(load("draft"));
  const row = lines.find((line) => lineText(line).startsWith("›"))!;
  const original = row.segments.find((s) => s.text.includes("Probe"))!;
  row.segments.splice(2, 0,
    { ...original, text: "⠁⠂" },
    { ...original, fg: "rgb(120,125,145)", dim: true, text: "⠄" },
    { ...original, fg: "rgb(120,125,145)", bold: true, text: "⡀" },
  );
  expect(codexAdapter.extractInputDraft(lines)).toContain("⠁⠂⠄⡀");
});
