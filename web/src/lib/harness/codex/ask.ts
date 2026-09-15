// Codex request_user_input: the whole question becomes a picker card. Option taps move the native
// pointer; a separate confirmation uses its digit. ASK_NOTES.md records why Enter differs on the
// notes row. The note composer stays in the card; its own guarded flow never sends option digits.
import type { StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, lineText, regionSignature, rstrip, skipBlanksUp } from "./markers";

export interface AskRegion {
  model: PickerModel;
  startLine: number;
}

// Upstream allows the interrupt hint to occupy its own row when the footer wraps. Keep the
// answer/navigation captures because the card model uses them to preserve native state.
const FOOTER = /^\s*tab to add notes \| enter to submit (answer|all)( \| ←\/→ (?:to )?navigate questions)?(?: \| esc to interrupt)?$/;
const NOTES_FOOTER = /^\s*tab or esc to clear notes \| enter to submit (answer|all)( \| ←\/→ (?:to )?navigate questions)?$/;
const NOTE_ROW = /^\s*›(?: |$)/;
const HEADER = /^\s*Question (\d+)\/(\d+) \((\d+) unanswered\)$/;
const OPTION = /^(?:\s{2}› |\s{4})([1-9])\. (.+)$/;
const MAX_ROWS = 100;

/** A complete painted question at the buffer tail, including its optional native notes. */
export function detectAskRegion(lines: StyledLine[]): AskRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const end = lastNonBlankIndex(texts);
  if (end < 0) return null;

  let footerRow = end;
  if (/^\s*esc to interrupt$/.test(texts[footerRow]!)) footerRow--;
  if (footerRow < 0) return null;
  const footerText = texts[footerRow]!.trim();
  const notesFooter = NOTES_FOOTER.exec(footerText);
  const footer = notesFooter ?? FOOTER.exec(footerText);
  if (!footer) return null;

  const headerFloor = Math.max(0, footerRow - MAX_ROWS);
  let header = footerRow - 1;
  for (; header >= headerFloor; header--) {
    if (HEADER.test(texts[header]!)) break;
  }
  if (header < headerFloor) return null;

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

  const firstOption = texts.findIndex((text, row) => row > header && row < footerRow && OPTION.test(text));
  if (firstOption < 0) return null;
  const questionLines = lines.slice(header + 1, firstOption).filter((line) => lineText(line).trim());
  const questionInk = questionLines.flatMap((line) => line.segments.filter((segment) => segment.text.trim()));
  if (!questionInk.length || questionInk.some((segment) => segment.bold || segment.dim || segment.bg !== background)) {
    return null;
  }
  const answered = questionInk.every((segment) => segment.fg === undefined);
  if (!answered && !questionInk.every((segment) => segment.fg === "var(--ansi-6)")) return null;
  if ((answered && unanswered === total) || (!answered && unanswered === 0)) return null;
  const question = questionLines.map((line) => lineText(line).trim()).join(" ");

  const options: PickerOption[] = [];
  const notesStart = notesFooter
    ? texts.findIndex(
        (text, row) => row > firstOption && row < footerRow && !texts[row - 1]!.trim() && NOTE_ROW.test(text),
      )
    : -1;
  if (notesFooter && notesStart < 0) return null;
  const optionsEnd = notesFooter ? notesStart : footerRow;
  const optionsLast = skipBlanksUp(texts, optionsEnd - 1);
  if (optionsLast < firstOption) return null;
  let continuation: string[] = [];
  let descriptionColumn: number | undefined;

  for (let row = firstOption; row <= optionsLast; row++) {
    const text = texts[row]!;
    if (!text.trim()) {
      // Blank rows belong between the options and the footer/notes box, not between options.
      return null;
    }

    const match = OPTION.exec(text);
    if (!match) {
      if (!options.length || !/^\s{6,}\S/.test(text) || /^\s*\d+\./.test(text)) return null;
      continuation.push(text);
      continue;
    }

    const optionNumber = Number(match[1]);
    if (optionNumber !== options.length + 1) return null;
    const raw = match[2]!.trim();
    const split = raw.split(/\s{2,}/);
    const label = (split[0] ?? raw).trim();
    const description = split.slice(1).join(" ").trim();

    if (continuation.length > 0) {
      // Wrapped rows must continue the previous option's description at its original column.
      const column = descriptionColumn;
      if (column === undefined || continuation.some((line) => line.search(/\S/) < column)) {
        return null;
      }
      const previous = options.at(-1)!;
      previous.description = [previous.description, ...continuation.map((line) => line.trim())]
        .filter(Boolean)
        .join(" ");
      continuation = [];
    }

    const pointed = match[0]!.includes("›");
    const ink = lines[row]!.segments.filter((segment) => segment.text.trim());
    if (pointed && !ink.every((segment) => segment.bold && !segment.dim && segment.fg === "var(--ansi-6)")) {
      return null;
    }
    options.push({
      id: match[1]!,
      label,
      description,
      pointed,
      current: false,
      checked: false,
      orderable: false,
    });
    const separator = /\s{2,}/.exec(raw);
    descriptionColumn = separator === null ? undefined : text.indexOf(raw) + separator.index + separator[0].length;
  }

  if (continuation.length > 0) {
    if (descriptionColumn === undefined || continuation.some((line) => line.search(/\S/) < descriptionColumn)) {
      return null;
    }
    const previous = options.at(-1)!;
    previous.description = [previous.description, ...continuation.map((line) => line.trim())]
      .filter(Boolean)
      .join(" ");
  }
  if (options.length < 2 || options.filter((option) => option.pointed).length !== 1) return null;

  let notes: { text: string; focused: boolean } | undefined;
  if (notesFooter) {
    const noteLines = lines.slice(notesStart, footerRow);
    if (noteLines.some((line) => line.segments.some((segment) => segment.text.trim() && segment.bg !== background))) {
      return null;
    }
    const noteMatch = /^\s*›\s?(.*)$/.exec(texts[notesStart]!);
    if (!noteMatch) return null;
    const first = noteMatch[1]!;
    const placeholder = first === "Add notes" && lines[notesStart]!.segments
      .filter((segment) => segment.text.includes("Add notes"))
      .every((segment) => segment.dim);
    const continuationLines = texts.slice(notesStart + 1, footerRow);
    if (continuationLines.some((line) => line.trim() && !/^\s{4}/.test(line))) return null;
    const text = [placeholder ? "" : first, ...continuationLines.map((line) => line.replace(/^\s{4}/, ""))]
      .join("\n")
      .trimEnd();
    notes = { text, focused: !footer[2] };
  }

  let start = header;
  while (
    start > 0 &&
    !texts[start - 1]!.trim() &&
    lines[start - 1]!.segments.length > 0 &&
    lines[start - 1]!.segments.every((segment) => segment.bg === background)
  ) {
    start--;
  }
  const signature = regionSignature(lines, start, end + 1);
  const questionnaire: NonNullable<PickerModel["questionnaire"]> = {
    index,
    total,
    unanswered,
    answered,
    submit: index === total ? "all" : "answer",
  };
  if (notes) questionnaire.notes = notes;

  return {
    startLine: start,
    model: {
      kind: "single",
      identity: "question:" + index + "/" + total + ":" + question,
      title: question,
      description: [],
      options,
      query: null,
      preview: [],
      footer: footerText,
      signature,
      regionSignature: signature,
      questionnaire,
    },
  };
}
