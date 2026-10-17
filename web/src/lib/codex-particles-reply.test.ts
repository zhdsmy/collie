import { readFileSync } from "node:fs";
import { join } from "node:path";
import { codexAdapter } from "./harness/codex";
import { parseAnsi } from "./ansi";
import { splitLines } from "./blocks";

const capture = readFileSync(join(import.meta.dirname, "../fixtures/panes/codex--v0154-particles-working.txt"), "utf8");
const paint = "\u001b[0m\u001b[48;2;57;57;71m";
const dot = "\u001b[0m\u001b[38;2;110;114;134m\u001b[48;2;57;57;71m⠄" + paint;

// Derived from the captured composer: replace its dim placeholder with ordinary typed rows,
// including a particle inside each text space. Nothing here types into a real terminal.
function typedFrame(draft: string) {
  const rows = draft.split("\n").map((row) => paint + row.replaceAll(" ", dot));
  return capture.replace("\u001b[2m\u001b[48;2;57;57;71mAsk Codex to do anything", rows.join("\n" + paint + "  "));
}

it.each([
  ["plain text", "请继续 检查 . · ⠁⠂", "请继续 检查 . · ⠁⠂"],
  ["blank paragraphs", "第一段\n\n第二段", "第一段\n\n第二段"],
  ["one image", "/test-state/uploads/a.jpg", "[Image #1]"],
  ["two images", "/test-state/uploads/a.jpg\n/test-state/uploads/b.png", "[Image #1] [Image #2]"],
  ["interleaved", "第一张 /test-state/uploads/a.jpg\n\n第二张 /test-state/uploads/b.png", "第一张 [Image #1]\n\n第二张 [Image #2]"],
  ["absolute path", "查看 /private/tmp/sample.png", "查看 /private/tmp/sample.png"],
])("extracts %s from the animated composer", (_label, _text, rendered) => {
  const after = typedFrame(rendered);
  expect(codexAdapter.extractInputDraft(splitLines(parseAnsi(after)))).toBe(rendered.replace(/\n+/g, " "));
});
