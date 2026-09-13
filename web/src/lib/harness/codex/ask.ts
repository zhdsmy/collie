// Codex request_user_input: the whole question becomes a picker card. Option taps move the native
// pointer; a separate confirmation uses its digit. ASK_NOTES.md records why Enter differs on the
// notes row. The note composer stays in the card; its own guarded flow never sends option digits.
import type { StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, lineText, regionSignature, rstrip } from "./markers";

export interface AskRegion {
  model: PickerModel;
  startLine: number;
}

const FOOTER = /^tab to add notes \| enter to submit (answer|all)( \| ←\/→ to navigate questions)? \| esc to interrupt$/;
const NOTES_FOOTER = /^tab or esc to clear notes \| enter to submit (answer|all)( \| ←\/→ to navigate questions)?$/;
const HEADER = /^ {2}Question (\d+)\/(\d+) \((\d+) unanswered\)$/;
const OPTION = /^( {2}› | {4})([1-9])\. (.+)$/;
const MAX_ROWS = 100;

/** A complete painted question at the buffer tail, including its optional native notes. */
export function detectAskRegion(lines: StyledLine[]): AskRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0) return null;
  const notesFooter = NOTES_FOOTER.exec(texts[tail]!.trim());
  const footer = notesFooter ?? FOOTER.exec(texts[tail]!.trim());
  if (!footer) return null;

  let header = tail - 1;
  for (; header >= Math.max(0, tail - MAX_ROWS); header--) {
    if (HEADER.test(texts[header]!)) break;
  }
  if (header < Math.max(0, tail - MAX_ROWS)) return null;
  const progress = HEADER.exec(texts[header]!)!;
  const index = Number(progress[1]);
  const total = Number(progress[2]);
  const unanswered = Number(progress[3]);
  if (index < 1 || index > total || total > 100 || unanswered > total) return null;
  if (!notesFooter && (total > 1) !== Boolean(footer[2])) return null;
  if (total > 1 && (index === total) !== (footer[1] === "all")) return null;

  const headerInk = lines[header]!.segments.filter((segment) => segment.text.trim());
  const background = headerInk[0]?.bg;
  if (!background || !headerInk.every((segment) => segment.dim && segment.bg === background)) return null;

  const firstOption = texts.findIndex((text, row) => row > header && row < tail && OPTION.test(text));
  if (firstOption < 0) return null;
  const questionLines = lines.slice(header + 1, firstOption).filter((line) => lineText(line).trim());
  const questionInk = questionLines.flatMap((line) => line.segments.filter((segment) => segment.text.trim()));
  if (!questionInk.length || questionInk.some((segment) => segment.bold || segment.dim || segment.bg !== background)) return null;
  const answered = questionInk.every((segment) => segment.fg === undefined);
  if (!answered && !questionInk.every((segment) => segment.fg === "var(--ansi-6)")) return null;
  if ((answered && unanswered === total) || (!answered && unanswered === 0)) return null;
  const question = questionLines.map((line) => lineText(line).trim()).join(" ");

  const options: PickerOption[] = [];
  const notesStart = notesFooter
    ? texts.findIndex((text, row) => row > firstOption && row < tail && !texts[row - 1]!.trim() && /^ {2}›(?: |$)/.test(text))
    : -1;
  if (notesFooter && notesStart < 0) return null;
  const optionsEnd = notesFooter ? notesStart : tail;
  for (let row = firstOption; row < optionsEnd; row++) {
    const text = texts[row]!;
    if (!text.trim()) continue;
    const match = OPTION.exec(text);
    if (!match) {
      const previous = options.at(-1);
      if (!previous || !/^ {6,}\S/.test(text)) return null;
      previous.description = [previous.description, text.trim()].filter(Boolean).join(" ");
      continue;
    }
    if (Number(match[2]) !== options.length + 1) return null;
    const pointed = match[1] === "  › ";
    const ink = lines[row]!.segments.filter((segment) => segment.text.trim());
    if (pointed && !ink.every((segment) => segment.bold && !segment.dim && segment.fg === "var(--ansi-6)")) return null;
    const [label, ...description] = match[3]!.trim().split(/ {2,}/);
    options.push({ id: match[2]!, label: label!, description: description.join(" "), pointed, current: false, checked: false, orderable: false });
  }
  if (options.length < 2 || options.filter((option) => option.pointed).length !== 1) return null;
  let notes: { text: string; focused: boolean } | undefined;
  if (notesFooter) {
    const noteLines = lines.slice(notesStart, tail);
    if (noteLines.some((line) => line.segments.some((segment) => segment.text.trim() && segment.bg !== background))) return null;
    const first = texts[notesStart]!.slice(4);
    const placeholder = first === "Add notes" && lines[notesStart]!.segments
      .filter((segment) => segment.text.includes("Add notes")).every((segment) => segment.dim);
    const continuation = texts.slice(notesStart + 1, tail);
    if (continuation.some((line) => line.trim() && !/^ {4}/.test(line))) return null;
    const text = [placeholder ? "" : first, ...continuation.map((line) => line.slice(4))].join("\n").trimEnd();
    notes = { text, focused: !footer[2] };
  }

  let start = header;
  while (start > 0 && !texts[start - 1]!.trim() && lines[start - 1]!.segments.length > 0 &&
    lines[start - 1]!.segments.every((segment) => segment.bg === background)) start--;
  const signature = regionSignature(lines, start, tail + 1);
  const questionnaire: NonNullable<PickerModel["questionnaire"]> = {
    index, total, unanswered, answered, submit: index === total ? "all" : "answer",
  };
  if (notes) questionnaire.notes = notes;
  return {
    startLine: start,
    model: {
      kind: "single", identity: "question:" + index + "/" + total + ":" + question, title: question,
      description: [], options, query: null, preview: [], footer: texts[tail]!.trim(),
      signature, regionSignature: signature,
      questionnaire,
    },
  };
}
