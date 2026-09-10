import { lineText, type StyledLine } from "../../blocks";
import type { PromptModel, PromptOption } from "../prompt-model";

const TITLE = /^╭─ Hermes needs your input ─+╮$/u;
const BOTTOM = /^╰─+╯$/u;
const HINT = /^\s*↑\/↓ to select, Enter to (confirm|lock, Tab next question)(?:\s+\(\d+s\))?$/u;
const OPTION = /^\s*(?:❯ )?([1-9]|0)\. (.+)$/u;

export interface ClarifyRegion {
  start: number;
  questionLines: StyledLine[];
  model: PromptModel;
}

/** Verified single-choice clarify cards. Batch mode answers the active question with a digit,
 * then Hermes advances itself. Checkboxes and free-text mode have different key semantics. */
export function detectClarify(lines: StyledLine[], statusStart: number): ClarifyRegion | null {
  const texts = lines.map((line) => lineText(line).trimEnd());
  let hint = statusStart - 1;
  while (hint >= 0 && !texts[hint]) hint--;
  const mode = HINT.exec(texts[hint] ?? "")?.[1];
  if (!mode) return null;
  let bottom = hint - 1;
  while (bottom >= Math.max(0, hint - 5) && !BOTTOM.test(texts[bottom]!)) {
    if (texts[bottom] && !/^\s*❓\s+clarify\s+\(/u.test(texts[bottom]!)) return null;
    bottom--;
  }
  if (bottom < 0 || !BOTTOM.test(texts[bottom]!)) return null;
  let top = bottom - 1;
  while (top >= Math.max(0, bottom - 150) && !TITLE.test(texts[top]!)) top--;
  if (top < 0 || !TITLE.test(texts[top]!)) return null;
  const rows: string[] = [];
  for (let i = top + 1; i < bottom; i++) {
    const row = texts[i]!;
    if (!row.startsWith("│ ") || !row.endsWith(" │")) return null;
    rows.push(row.slice(2, -2).trimEnd());
  }
  if (rows.some((row) => /\[[ x]\]|\(question truncated\)|Other:|type below/u.test(row))) return null;
  const batch = mode !== "confirm";
  const count = /^(\d+) questions$/u.exec(rows[0] ?? "");
  if (batch !== Boolean(count)) return null;
  const first = rows.findIndex((row) => OPTION.test(row));
  if (first < 1) return null;
  let questionStart = first - 1;
  if (batch) {
    while (questionStart >= 1 && !/^[▸✓] /u.test(rows[questionStart]!)) questionStart--;
    if (questionStart < 1) return null;
  } else questionStart = 0;
  const question = rows.slice(questionStart, first).join(" ").trim().replace(/^[▸✓] /u, "");
  if (!question || question.startsWith("→ ")) return null;
  const options: PromptOption[] = [];
  let sawOther = false;
  let pointers = 0;
  for (let i = first; i < rows.length; i++) {
    const row = rows[i]!;
    if (batch && /^[·✓▸] /u.test(row)) break;
    const option = OPTION.exec(row);
    if (option) {
      if (sawOther || options.length >= 10) return null;
      const key = option[1]!;
      if (Number(key) !== (options.length + 1) % 10) return null;
      if (row.trimStart().startsWith("❯")) pointers++;
      options.push({ label: option[2]!, keys: [key] });
    } else if (row.trim()) {
      const previous = options.at(-1);
      if (!previous || !/^\s{2}/u.test(row)) return null;
      previous.label += ` ${row.trim()}`;
    }
    if (options.at(-1)?.label === "Other (type your answer)") sawOther = true;
  }
  if (!sawOther || pointers !== 1 || options.length < 2) return null;
  // Timer, spinner and metrics change without changing what a digit means. Compare only the
  // complete card and mode, while binding the write to the fresh literal card + footer at the tail.
  const signature = texts.slice(top, bottom + 1).join("\n") + `\n${mode}`;
  const questionLines = rows.slice(0, first).filter((row) => row.trim()).map((text) => ({
    segments: [{ text, style: {}, muted: false }],
  }));
  return { start: top, questionLines, model: {
    family: "select", question, options, signature, coreSignature: signature,
    regionSignature: lines.slice(top).map(lineText).join("\n"),
  } };
}
