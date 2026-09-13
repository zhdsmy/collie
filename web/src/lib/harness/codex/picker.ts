// Codex 0.154 pickers: verified title + painted rows + exact tail footer. PICKER_NOTES.md
// records the native keyboard recipes; parsing here remains I/O-free.
import { lineText, type StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, rstrip } from "./markers";

const SINGLE_FOOTER = "Press enter to confirm or esc to go back";
const MULTIPLE_FOOTER = "Press space to toggle; ←/→ to move; enter to confirm and close; esc to close";
const MODEL_TITLE = /^(?:Select Model(?: and Effort)?|Select Reasoning Level for .+|Advanced Reasoning|Apply reasoning change)$/;
const NUMBERED = /^(› | {2})([1-9]\d*)\. (\S.*)$/;
const CHECKBOX = /^(› | {2})\[([ x])\] (\S.*)$/;
const MAX_ROWS = 100;

export interface PickerRegion {
  startLine: number;
  model: PickerModel;
}

function painted(line: StyledLine, flag: "bold" | "dim"): boolean {
  const text = line.segments.filter((s) => s.text.trim().length > 0);
  return text.length > 0 && text.every((s) => s[flag] === true);
}

function columns(text: string) {
  const gap = / {2,}/.exec(text);
  if (!gap) return { label: text, description: "" };
  return {
    label: text.slice(0, gap.index),
    description: text.slice(gap.index + gap[0].length),
  };
}

function readOptions(
  lines: StyledLine[],
  texts: string[],
  start: number,
  end: number,
  multiple: boolean,
): PickerOption[] | null {
  const options: PickerOption[] = [];
  for (let i = start; i < end; i++) {
    const text = texts[i]!;
    if (!text.trim()) continue;
    if (multiple && /^ {2}─+$/.test(text)) {
      if (options.at(-1)?.id !== "Use theme colors") return null;
      continue;
    }
    const match = (multiple ? CHECKBOX : NUMBERED).exec(text);
    if (match) {
      const pointed = match[1] === "› ";
      if (pointed && !painted(lines[i]!, "bold")) return null;
      const copy = columns(match[3]!);
      const current = copy.label.endsWith(" (current)");
      const label = copy.label.replace(/ \(current\)$/, "");
      const id = multiple ? label : match[2]!;
      if (!label || options.some((option) => option.id === id)) return null;
      if (!multiple && options.length > 0 && Number(id) !== Number(options.at(-1)!.id) + 1) {
        return null;
      }
      options.push({
        id,
        label,
        description: copy.description,
        pointed,
        current,
        checked: multiple && match[2] === "x",
        orderable: multiple && label !== "Use theme colors",
      });
      continue;
    }
    // Codex puts wrapped descriptions beneath their numbered/checkbox row. Never consume a
    // second widget, a footer, or an unindented transcript line as option copy.
    const previous = options.at(-1);
    if (!previous || !/^ {5,}\S/.test(text)) return null;
    previous.description = [previous.description, text.trim()].filter(Boolean).join(" ");
  }
  return options;
}

/** Only the current, complete dialog at the buffer tail can acquire keyboard ownership. */
export function detectPickerRegion(lines: StyledLine[]): PickerRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0 || !painted(lines[tail]!, "dim")) return null;
  const footer = texts[tail]!.trim();
  const multiple = footer === MULTIPLE_FOOTER;
  if (!multiple && footer !== SINGLE_FOOTER) return null;

  let start = tail - 1;
  for (; start >= Math.max(0, tail - MAX_ROWS); start--) {
    const title = texts[start]!.trim();
    if ((multiple ? title === "Configure Status Line" : MODEL_TITLE.test(title)) &&
      painted(lines[start]!, "bold")) break;
  }
  if (start < Math.max(0, tail - MAX_ROWS)) return null;
  const title = texts[start]!.trim();
  let optionsStart = start + 1;
  let optionsEnd = tail;
  let query: string | null = null;
  let preview: StyledLine[] = [];
  const description: string[] = [];

  if (multiple) {
    const search = texts.findIndex((text, index) => index > start && index < tail && text.trim() === "Type to search");
    if (search < 0 || !painted(lines[search]!, "dim")) return null;
    const input = /^ {2}>(?: (.*))?$/.exec(texts[search + 1] ?? "");
    if (!input) return null;
    query = input[1] ?? "";
    optionsStart = search + 2;
    description.push(...texts.slice(start + 1, search).map((text) => text.trim()).filter(Boolean));
    // Codex omits the preview row entirely when nothing is selected. With a preview,
    // a blank row separates it from the list; without one that gap precedes the footer.
    if (tail - optionsStart < 2) return null;
    if (!texts[tail - 1]!.trim()) {
      optionsEnd = tail - 1;
    } else {
      if (texts[tail - 2]!.trim()) return null;
      optionsEnd = tail - 2;
      preview = [lines[tail - 1]!];
    }
  } else {
    while (optionsStart < tail && !NUMBERED.test(texts[optionsStart]!)) {
      const text = texts[optionsStart]!.trim();
      if (text) description.push(text);
      optionsStart++;
    }
  }

  const emptySearch = multiple && query !== "" &&
    texts.slice(optionsStart, optionsEnd).filter((text) => text.trim()).length === 1 &&
    texts[optionsStart]?.trim() === "no matches" && painted(lines[optionsStart]!, "dim");
  const options = emptySearch ? [] : readOptions(lines, texts, optionsStart, optionsEnd, multiple);
  if (!options || options.filter((option) => option.pointed).length !== (emptySearch ? 0 : 1)) return null;
  const regionSignature = texts.slice(start, tail + 1).join("\n");
  return {
    startLine: start,
    model: {
      kind: multiple ? "multiple" : "single",
      identity: `${multiple ? "statusline" : "model"}:${title}\n${description.join("\n")}`,
      title,
      description,
      options,
      query,
      preview,
      footer,
      signature: regionSignature,
      regionSignature,
    },
  };
}
