// Codex request_user_input: the whole question becomes a picker card. Option taps move the native
// pointer; a separate confirmation uses its digit. ASK_NOTES.md records why Enter differs on the
// notes row. Notes-focused screens stay raw, so no option key can type into the user's notes.
import type { StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, lineText, regionSignature, rstrip } from "./markers";

export interface AskRegion {
  model: PickerModel;
  startLine: number;
}

const FOOTER = /^tab to add notes \| enter to submit (answer|all)( \| ←\/→ to navigate questions)? \| esc to interrupt$/;
const HEADER = /^ {2}Question (\d+)\/(\d+) \((\d+) unanswered\)$/;
const OPTION = /^( {2}› | {4})([1-9])\. (.+)$/;
const MAX_ROWS = 100;

/** A complete painted question at the buffer tail, never notes or an unrelated numbered list. */
export function detectAskRegion(lines: StyledLine[]): AskRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0) return null;
  const footer = FOOTER.exec(texts[tail]!.trim());
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
  if ((total > 1) !== Boolean(footer[2])) return null;
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
  for (let row = firstOption; row < tail; row++) {
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

  let start = header;
  while (start > 0 && !texts[start - 1]!.trim() && lines[start - 1]!.segments.length > 0 &&
    lines[start - 1]!.segments.every((segment) => segment.bg === background)) start--;
  const signature = regionSignature(lines, start, tail + 1);
  return {
    startLine: start,
    model: {
      kind: "single", identity: "question:" + index + "/" + total + ":" + question, title: question,
      description: [], options, query: null, preview: [], footer: texts[tail]!.trim(),
      signature, regionSignature: signature,
      questionnaire: { index, total, unanswered, answered, submit: index === total ? "all" : "answer" },
    },
  };
}
