import { graphemeSegmenter } from "./env";

/** Minimum visible characters that must match before we believe the input box holds OUR text. */
export const MIN_MATCH_CHARS = 8;

const REGEXP_META = /[.*+?^${}()|[\]\\]/g;
const FOLD_SEAM = " ";
const GRAPHEMES = graphemeSegmenter();
const UNREADABLE = /^[\s\p{Default_Ignorable_Code_Point}]+$/u;

function visibleLength(text: string): number {
  let length = 0;
  if (GRAPHEMES === null) {
    for (const character of text) if (!UNREADABLE.test(character)) length += 1;
    return length;
  }
  for (const segment of GRAPHEMES.segment(text)) {
    if (!UNREADABLE.test(segment.segment)) length += 1;
  }
  return length;
}

function characterBoundaries(text: string): Set<number> {
  const boundaries = new Set<number>([text.length]);
  if (GRAPHEMES === null) {
    let index = 0;
    for (const character of text) {
      boundaries.add(index);
      index += character.length;
    }
    return boundaries;
  }
  for (const segment of GRAPHEMES.segment(text)) boundaries.add(segment.index);
  return boundaries;
}

/**
 * Whether the input box's visible draft is evidence that `sent` landed there. The box windows long
 * drafts and folds wrapped lines together with a space, so exact equality is too strict. Non-space
 * runs must still appear contiguously and in order; only a single plain-space fold seam may collapse.
 * Other whitespace remains exact, and matches must land on grapheme boundaries.
 */
export function draftCarriesSend(sent: string, draft: string | null): boolean {
  if (draft === null) return false;
  const parts = draft.trim().split(/(\s+)/);
  const runs = parts.filter((_part, index) => index % 2 === 0);
  const gaps = parts.filter((_part, index) => index % 2 === 1);
  if (runs.length === 0 || runs[0]!.length === 0) return false;

  const visible = runs.reduce((length, run) => length + visibleLength(run), 0);
  if (visible < Math.min(visibleLength(sent), MIN_MATCH_CHARS)) return false;

  const escape = (text: string) => text.replace(REGEXP_META, "\\$&");
  let pattern = escape(runs[0]!);
  for (let index = 1; index < runs.length; index++) {
    const gap = gaps[index - 1]!;
    pattern += (gap === FOLD_SEAM ? "\\s*" : escape(gap)) + escape(runs[index]!);
  }

  const scan = new RegExp(pattern, "g");
  const boundaries = characterBoundaries(sent);
  for (let match = scan.exec(sent); match !== null; match = scan.exec(sent)) {
    if (boundaries.has(match.index) && boundaries.has(match.index + match[0].length)) return true;
    scan.lastIndex = match.index + 1;
  }
  return false;
}
