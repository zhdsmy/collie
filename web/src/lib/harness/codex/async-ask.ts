// Native async_questions is a pending queue, not request_user_input's staged questionnaire.
// Captured keys and paint are documented in ASYNC_ASK_NOTES.md. Unknown/truncated chrome stays raw.
import type { StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import type { AskRegion } from "./ask";
import { locateComposer } from "./chrome";
import { lastNonBlankIndex, lineText, regionSignature, rstrip } from "./markers";

const ACCENT = "var(--ansi-6)";
const OPTION = /^ {2}(› |  )([1-9]\d?)\. (.*)$/;
const FOOTER = /^enter submit ctrl \+ \] skip (?:⌥|alt) \+ ↓ (main prompt|prev question)(?: (?:⌥|alt) \+ ↑ (next question|queued messages))?$/;

function ink(line: StyledLine) {
  return line.segments.filter((segment) => segment.text.trim());
}

function model(title: string, signature: string, index: number, total: number): PickerModel {
  return {
    kind: "single", identity: JSON.stringify(["codex-async-question", title, index, total]),
    title, description: [], options: [], query: null, preview: [], footer: "",
    signature, regionSignature: signature,
    questionnaire: { index, total, unanswered: total, answered: false, submit: "answer",
      async: { collapsed: false, otherId: null } },
  };
}

function previewStart(texts: string[], row: number): number {
  return texts[row - 1] === "• Queued follow-up inputs" ? row - 1 : row;
}

function collapsed(lines: StyledLine[], texts: string[]): AskRegion | null {
  const composer = locateComposer(lines);
  if (!composer) return null;
  let hint = composer.promptRow - 1;
  while (hint >= 0 && !texts[hint]!.trim()) hint--;
  if (hint < 1 || !/^ {4}(?:⌥|alt) \+ ↑ to answer$/.test(texts[hint]!) ||
      !ink(lines[hint]!).every((segment) => segment.dim && !segment.bg)) return null;
  const count = /^ {2}\? (\d+) questions?(?: · \d+s)?$/.exec(texts[hint - 1]!);
  const total = Number(count?.[1]);
  if (!count || total < 1 || !Number.isSafeInteger(total)) return null;
  if (!ink(lines[hint - 1]!).some((segment) => segment.fg === ACCENT && segment.bold &&
      segment.text === `${total} question${total === 1 ? "" : "s"}`)) return null;
  // The countdown is volatile, but the count and live input still participate in the guard.
  const region = regionSignature(lines, hint, composer.statusRow + 1);
  const result = model(`${total} question${total === 1 ? "" : "s"}`, `${total}\n${region}`, 0, total);
  result.regionSignature = region;
  result.questionnaire!.async!.collapsed = true;
  return { startLine: previewStart(texts, hint - 1), model: result };
}

export function detectAsyncAskRegion(lines: StyledLine[]): AskRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const preview = collapsed(lines, texts);
  if (preview) return preview;
  const end = lastNonBlankIndex(texts);
  if (end < 0) return null;
  let footer = end;
  while (footer >= Math.max(0, end - 3) && !texts[footer]!.trimStart().startsWith("enter submit")) footer--;
  if (footer < Math.max(0, end - 3)) return null;
  const footerText = texts.slice(footer, end + 1).join(" ").trim().replace(/\s+/g, " ");
  const hints = FOOTER.exec(footerText);
  const submitInk = ink(lines[footer]!)[0];
  const background = submitInk?.bg;
  if (!hints || !background || submitInk?.text !== "enter submit" ||
      !submitInk.bold || submitInk.dim || submitInk.fg !== ACCENT) return null;
  if (lines.slice(footer, end + 1).some((line) => ink(line).some((segment) =>
    segment.bg !== background || (segment !== submitInk && !segment.dim)))) return null;

  let top = footer;
  while (top > 0 && footer - top < 100 && lines[top - 1]!.segments.length > 0 &&
    lines[top - 1]!.segments.every((segment) => segment.bg === background)) top--;
  // A fully visible menu starts with a painted padding row, never halfway through a question.
  if (texts[top]!.trim()) return null;
  let row = top + 1;
  while (row < footer && !texts[row]!.trim()) row++;
  const progress = /^ {2}(\d+) of (\d+)$/.exec(texts[row] ?? "");
  const index = progress ? Number(progress[1]) : 1;
  const total = progress ? Number(progress[2]) : 1;
  if (index < 1 || total < index || total > 1000) return null;
  if ((hints[1] === "prev question") !== (index > 1) ||
      (hints[2] === "next question") !== (index < total)) return null;
  if (progress) {
    if (!ink(lines[row]!).every((segment) => segment.dim)) return null;
    row++;
  }
  while (row < footer && !texts[row]!.trim()) row++;
  const question: string[] = [];
  while (row < footer) {
    if (!texts[row]!.trim()) { row++; continue; }
    if (OPTION.test(texts[row]!) || !ink(lines[row]!).every((segment) => segment.bold && !segment.dim && segment.fg === ACCENT)) break;
    question.push(texts[row]!.trim());
    row++;
  }
  if (question.length === 0) return null;
  while (row < footer && !texts[row]!.trim()) row++;
  if (row >= footer) return null;
  const result = model(question.join(" "), regionSignature(lines, top, end + 1), index, total);
  result.footer = footerText;
  const questionnaire = result.questionnaire!;
  const options: PickerOption[] = [];
  const optionRows: number[] = [];
  const firstOption = OPTION.test(texts[row]!);
  if (firstOption) {
    for (; row < footer; row++) {
      const match = OPTION.exec(texts[row]!);
      if (match) {
        // ponytail: only complete option windows; clipped lists stay native until captured.
        if (Number(match[2]) !== options.length + 1 || options.length >= 33) return null;
        const pointed = match[1] === "› ";
        const marker = ink(lines[row]!)[0];
        if (pointed && (!marker?.bold || marker.dim || marker.fg !== ACCENT)) return null;
        options.push({ id: match[2]!, label: match[3]!, description: "", pointed,
          current: false, checked: false, orderable: false });
        optionRows.push(row);
      } else if (texts[row]!.trim()) {
        const previous = options.at(-1);
        const column = 6 + (previous?.id.length ?? 0);
        if (!previous || !texts[row]!.startsWith(" ".repeat(column))) return null;
        previous.label += `\n${texts[row]!.slice(column)}`;
      }
    }
    if (options.length < 2 || options.filter((option) => option.pointed).length !== 1) return null;
    const other = options.at(-1)!;
    const otherRow = optionRows.at(-1)!;
    const otherColumn = 6 + other.id.length;
    questionnaire.async!.otherId = other.id;
    const empty = other.label === "Other" && (!other.pointed ||
      ink(lines[otherRow]!).some((segment) => segment.text.trim() === "Other" && segment.dim));
    questionnaire.notes = {
      text: empty ? "" : other.pointed
        ? [OPTION.exec(texts[otherRow]!)![3]!, ...texts.slice(otherRow + 1, footer).map((line) => line.slice(otherColumn))].join("\n").trimEnd()
        : other.label,
      focused: other.pointed,
    };
    other.label = "Other";
    result.options = options;
  } else {
    const empty = texts[row]!.trim() === "Type your answer" && ink(lines[row]!).every((segment) => segment.dim);
    if (texts.slice(row, footer).some((line) => line.trim() && !line.startsWith("  "))) return null;
    questionnaire.notes = { text: empty ? "" : texts.slice(row, footer).map((line) => line.slice(2)).join("\n").trimEnd(), focused: true };
  }
  // Keep identity stable while moving the pointer and editing the native Other field.
  result.identity = JSON.stringify([result.identity, options.map((option) => [option.id, option.label])]);
  return { startLine: previewStart(texts, top), model: result };
}
