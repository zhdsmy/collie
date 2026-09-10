import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { promptsEqual } from "../prompt-model";
import { DIALOG_CONTRACT } from "../dialog-contract";
import { describeAdapterConformance } from "../conformance";
import { hermesAdapter } from "./index";

const panes = join(import.meta.dirname, "../../../fixtures/panes");
const load = (name: string) => readFileSync(join(panes, `hermes--clarify-${name}.txt`), "utf8");
const lines = (text: string) => splitLines(parseAnsi(text));
const blocks = (text: string) => hermesAdapter.buildBlocks(lines(text));
function prompt(text: string) {
  const block = blocks(text).find((b) => b.kind === "prompt-select");
  if (!block || block.kind !== "prompt-select") throw new Error("Expected a clarify card");
  return block.prompt;
}

it("lifts active batch choices with one digit and advances to the captured next question", () => {
  const first = prompt(load("q0"));
  expect(first.question).toBe("选择测试方案？");
  expect(first.options.map((o) => o.keys)).toEqual([["1"], ["2"], ["3"], ["4"]]);
  expect(first.options.at(-1)!.label).toBe("Other (type your answer)");
  const next = prompt(load("q1"));
  expect(next.question).toBe("Which output format should the sample use?");
  expect(next.options[1]!.label).toBe("Markdown");
  expect(promptsEqual(first, next)).toBe(false);
  const raw = blocks(load("q1"))[0]!;
  expect(raw.lines.map(lineText).join("\n")).toContain("显示摘要");
});

it("submits single-question choices on the digit alone", () => {
  const card = prompt(load("single"));
  expect(card.question).toBe("Which sample should be shown?");
  expect(card.options[1]).toEqual({ label: "A detailed example", keys: ["2"] });
});

it("keeps the model and context fixed below the native clarify card", () => {
  const status = hermesAdapter.extractStatusLines(lines(load("q0"))).map(lineText).join("\n");
  expect(status).toContain("example-model");
  expect(status).toContain("~19.5K/1M");
});

it("keeps raw custom-answer mode writable with the existing Hermes transport", () => {
  expect(blocks(load("other")).map((b) => b.kind)).toEqual(["raw"]);
  expect(hermesAdapter.displayOnly).toBe(true);
  expect(blocks(load("other")).flatMap((b) => b.lines).map(lineText).join("\n")).toContain("type below");
});

it("does not stale a choice when only its countdown or metrics change, but binds the fresh literal frame", () => {
  const original = load("q0");
  const a = original.replace("Tab next question", "Tab next question (89s)");
  const b = original.replace("Tab next question", "Tab next question (88s)").replace("65.3%", "66.0%");
  const before = prompt(a), after = prompt(b);
  expect(promptsEqual(before, after)).toBe(true);
  expect(DIALOG_CONTRACT["prompt-select"].region(after)).toContain("(88s)");
  expect(DIALOG_CONTRACT["prompt-select"].region(after)).toContain("66.0%");
  expect(lines(b).map(lineText).join("\n")).toContain(DIALOG_CONTRACT["prompt-select"].region(after));
});

it("rejects a stale choice when a question, option or answered question changes", () => {
  const first = load("q0"), next = load("q1");
  for (const [source, before, after] of [
    [first, "选择测试方案？", "选择另一个方案？"],
    [first, "显示摘要", "执行另一个选项"],
    [next, "显示摘要", "已选择其他方案"],
  ]) expect(promptsEqual(prompt(source!), prompt(source!.replace(before!, after!)))).toBe(false);
});

it.each([
  (text: string) => text + "\nAgent continued working.\n",
  (text: string) => text.replace("Hermes needs your input", "Printed example of a menu"),
  (text: string) => text.replace("Tab next question", "do something else"),
  (text: string) => text.replace("Other (type your answer)", "Other (type below)"),
  (text: string) => text.replace("1. 检查", "1. [ ] 检查"),
  (text: string) => text.replace("3. 验证", "8. 验证"),
  (text: string) => text.replace("? ❯", "✎ ❯"),
  (text: string) => text.replace("? ❯", "? ❯ some typed text"),
])("refuses stale, unknown, checkbox and free-text screens", (change) => {
  expect(blocks(change(load("q0"))).map((b) => b.kind)).toEqual(["raw"]);
});

describeAdapterConformance(hermesAdapter, {
  ownFixtures: ["hermes--clarify-q0.txt", "hermes--clarify-q1.txt", "hermes--clarify-single.txt"],
  foreignFixtures: readdirSync(panes).filter((name) => !name.startsWith("hermes--") && name.endsWith(".txt")),
  neutralFixtures: ["hermes--clarify-other.txt", "hermes--done.txt", "hermes--working.txt"],
});
