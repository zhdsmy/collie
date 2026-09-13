// Codex 0.154 review pickers. The preset list and its base/commit submenus are
// native single-choice screens; custom review instructions deliberately remain raw.
import { lineText, type StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, rstrip } from "./markers";

export interface ReviewRegion {
  startLine: number;
  model: PickerModel;
}

const FOOTER = "Press enter to confirm or esc to go back";
const PRESET_TITLE = "Select a review preset";
const BASE_TITLE = "Select a base branch";
const COMMIT_TITLE = "Select a commit to review";
const BASE_QUERY = "Type to search branches";
const COMMIT_QUERY = "Type to search commits";
const NUMBERED = /^(› | {2})([1-9]\d*)\. (\S.*)$/;
const ROW = /^(› | {2})(\S.*)$/;
const MAX_ROWS = 100;

function ink(line: StyledLine) {
  return line.segments.filter((segment) => segment.text.trim().length > 0);
}

function paintedTitle(line: StyledLine): boolean {
  const segments = ink(line);
  return segments.length > 0 && segments.every((segment) => segment.bold === true && segment.dim !== true);
}

function paintedFooter(line: StyledLine): boolean {
  const segments = ink(line);
  return segments.length > 0 && segments.every((segment) => segment.dim === true);
}

function paintedPointer(line: StyledLine): boolean {
  const segments = ink(line);
  return (
    segments.length > 0 &&
    segments.every((segment) => segment.bold === true && segment.dim !== true && segment.fg === "var(--ansi-6)")
  );
}

function columns(text: string) {
  const gap = / {2,}/.exec(text);
  if (!gap) return { label: text, description: "" };
  return {
    label: text.slice(0, gap.index),
    description: text.slice(gap.index + gap[0].length),
  };
}

function numberedOptions(lines: StyledLine[], texts: string[], start: number, end: number): PickerOption[] | null {
  const options: PickerOption[] = [];
  for (let index = start; index < end; index++) {
    const text = texts[index]!;
    if (!text.trim()) {
      if (options.length > 0) {
        if (texts.slice(index + 1, end).some((remaining) => remaining.trim())) return null;
        break;
      }
      continue;
    }
    const match = NUMBERED.exec(text);
    if (!match || Number(match[2]) !== options.length + 1) return null;
    const copy = columns(match[3]!);
    options.push({
      id: match[2]!,
      label: copy.label,
      description: copy.description,
      pointed: match[1] === "› ",
      current: false,
      checked: false,
      orderable: false,
    });
    if (match[1] === "› " && !paintedPointer(lines[index]!)) return null;
  }
  return options.length > 0 ? options : null;
}

function listOptions(lines: StyledLine[], texts: string[], start: number, end: number): PickerOption[] | null {
  const options: PickerOption[] = [];
  for (let index = start; index < end; index++) {
    const text = texts[index]!;
    if (!text.trim()) {
      if (options.length > 0) {
        if (texts.slice(index + 1, end).some((remaining) => remaining.trim())) return null;
        break;
      }
      continue;
    }
    const match = ROW.exec(text);
    if (!match) return null;
    options.push({
      id: match[2]!,
      label: match[2]!,
      description: "",
      pointed: match[1] === "› ",
      current: false,
      checked: false,
      orderable: false,
    });
    if (match[1] === "› " && !paintedPointer(lines[index]!)) return null;
  }
  return options.length > 0 ? options : null;
}

function makeModel(
  stage: "preset" | "base" | "commit",
  title: string,
  options: PickerOption[],
  texts: string[],
  start: number,
  tail: number,
): PickerModel {
  const regionSignature = texts.slice(start, tail + 1).join("\n");
  return {
    kind: "single",
    identity: `review:${stage}`,
    title,
    description: [],
    options,
    query: null,
    preview: [],
    footer: FOOTER,
    signature: regionSignature,
    regionSignature,
  };
}

/** Only a complete review picker at the terminal tail may claim keyboard ownership. */
export function detectReviewRegion(lines: StyledLine[]): ReviewRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0 || texts[tail]!.trim() !== FOOTER || !paintedFooter(lines[tail]!)) return null;

  let titleIndex = -1;
  for (let index = tail - 1; index >= Math.max(0, tail - MAX_ROWS); index--) {
    const title = texts[index]!.trim();
    if ((title === PRESET_TITLE || title === BASE_TITLE || title === COMMIT_TITLE) && paintedTitle(lines[index]!)) {
      titleIndex = index;
      break;
    }
  }
  if (titleIndex < 0) return null;

  const title = texts[titleIndex]!.trim();
  let options: PickerOption[] | null;
  let stage: "preset" | "base" | "commit";
  if (title === PRESET_TITLE) {
    stage = "preset";
    options = numberedOptions(lines, texts, titleIndex + 1, tail);
  } else {
    stage = title === BASE_TITLE ? "base" : "commit";
    const query = stage === "base" ? BASE_QUERY : COMMIT_QUERY;
    const queryIndex = texts.findIndex((text, index) => index > titleIndex && index < tail && text.trim() === query);
    if (queryIndex < 0 || !paintedFooter(lines[queryIndex]!)) return null;
    options = listOptions(lines, texts, queryIndex + 1, tail);
  }
  if (!options || options.filter((option) => option.pointed).length !== 1 || new Set(options.map((option) => option.id)).size !== options.length) return null;

  return {
    startLine: titleIndex,
    model: makeModel(stage, title, options, texts, titleIndex, tail),
  };
}
