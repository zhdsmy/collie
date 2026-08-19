/** Minimum visible characters that must match before we believe the input box holds OUR text. */
export const MIN_MATCH_CHARS = 8;

const REGEXP_META = /[.*+?^${}()|[\]\\]/g;

/** The exact gap extractInputDraft's fold inserts at a wrap seam: one plain space, always. Any
 * other gap on screen is whitespace the operator really typed, so `sent` must carry it too. */
const FOLD_SEAM = " ";

/** `Intl.Segmenter` is the newest platform API anything in this bundle depends on (Firefox 125,
 * Safari 14.1), and this module is in the main chunk. Feature-detect so an older engine loses
 * grapheme precision rather than white-screening the PWA during module evaluation. */
const GRAPHEMES =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** A cluster nobody can see: whitespace or formatting controls that render as nothing. */
const UNREADABLE = /^[\s\p{Default_Ignorable_Code_Point}]+$/u;

/** Count visible grapheme clusters without first stripping spaces, which could fuse neighbours. */
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

/** Every offset where one visible character ends and the next begins, plus both string ends. */
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
