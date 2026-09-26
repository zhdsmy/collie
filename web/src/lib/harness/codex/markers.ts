// Shared lexing helpers over the parsed `StyledLine[]` — the primitives Codex's chrome stripping
// and dialog grammars lean on. Same methodology as harness/claude/markers.ts and
// harness/omp/markers.ts and deliberately NOT the same code: an adapter that imported another
// adapter's predicates would inherit that harness's renderer archaeology. Codex's chrome is
// BOXLESS: a bare `› ` prompt row wraps onto two-space-indented continuation rows, with a
// dot-separated status row underneath — and a SUBMITTED message echoes into the transcript with
// the same `› ` prefix, so nothing here is decisive without the tail anchoring locateComposer
// does. They operate on the *parsed* line text (segment text joined), never raw ANSI bytes.
// Pure functions, no I/O, no React.

import type { AnsiSegment } from "../../ansi";
import { isBlank, lineText, type StyledLine } from "../../blocks";

// `lineText` / `isBlank` are properties of a StyledLine, not of any grammar, so they live in the
// neutral core (lib/blocks.ts). Re-exported here so the Codex grammars keep their single import
// site — the same arrangement the other adapters use, for the same reason.
export { isBlank, lineText };

/** Drop TRAILING whitespace only. Codex pads rows to the pane width; an anchored `…$` regex
 *  would never match without this. Leading whitespace is load-bearing (it distinguishes the
 *  selected `› 1.` option row from the unselected `  2.` one), so it stays. */
export function rstrip(text: string): string {
  return text.replace(/\s+$/, "");
}

/** True when EVERY non-blank segment carries the flag — the renderer's own paint, not a guess from
 *  the text. Codex marks a live title `bold` and its chrome and footers `dim`. */
export function painted(line: StyledLine, flag: "bold" | "dim"): boolean {
  const text = line.segments.filter((segment) => segment.text.trim().length > 0);
  return text.length > 0 && text.every((segment) => segment[flag] === true);
}

// Context-bearing status rows also appear without field paint in the current fullscreen footer.
// Other configurable status rows are identified by renderer paint. The final low-priority field
// may share one dim segment with its separator (` · Main [default]`).
const STATUS_ROW =
  /^ {2}\S.* · (?:(?:.* · )+Context \d+% (?:left|used)\b|Context \d+% (?:left|used)\b · \S)/;

// While a turn is running Codex replaces the normal status row with a two-line footer:
// `tab to queue message` followed by `50% context left`. It is still composer chrome,
// but it has no dot separators or model field, so it needs a narrow explicit grammar.
const WORKING_QUEUE_ROW = /^\s*tab\s+to\s+queue\s+message\b/i;
const WORKING_CONTEXT_ROW = /^\s*\d+%\s+context\s+(?:left|used)\b/i;

// Codex can render the queue hint and context metric on one raw footer row while a turn is active.
// The key is configurable; the queue wording and context metric are the stable parts.
const INLINE_QUEUE_CONTEXT_ROW =
  /^ {2}\S.*\bto queue(?: message)?\s+\d+% context (?:left|used)\b/;

/** The exact separator paint Codex renders between status fields. */
const STATUS_SEPARATOR = " \u00b7 ";
/** Bounds. A status field is a model name, a path or a branch — never a paragraph. */
const MAX_STATUS_FIELD_CHARS = 160;
const MAX_STATUS_ROW_CHARS = 512;
const MIN_STATUS_FIELDS = 2;
const MAX_STATUS_FIELDS = 12;
const STATUS_INDENT = "  ";

function codePointCount(text: string): number {
  return [...text].length;
}

/**
 * A C0/DEL byte anywhere in the row. Scanned by code unit rather than matched by a pattern, the way
 * links.ts cuts the same bytes out of an href. Tab is not one of them: Codex indents with it, and a
 * row that carries one is still an ordinary row.
 */
function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x09) continue;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** A coloured, unemphasised field segment: the paint Codex gives every status field. */
function isFieldSegment(segment: AnsiSegment): boolean {
  if (segment.fg === undefined || segment.bg !== undefined) return false;
  if (segment.bold === true || segment.dim === true) return false;
  if (segment.text.length === 0 || segment.text !== segment.text.trim()) return false;
  return codePointCount(segment.text) <= MAX_STATUS_FIELD_CHARS;
}

/** A dim ` \u00b7 ` separator segment, painted exactly so and nothing else. */
function isSeparatorSegment(segment: AnsiSegment): boolean {
  if (segment.text !== STATUS_SEPARATOR) return false;
  if (segment.dim !== true) return false;
  return segment.fg === undefined && segment.bg === undefined && segment.bold !== true;
}

/** One final low-priority field that Codex paints in the same dim segment as its separator. */
function isDimSuffixFieldSegment(segment: AnsiSegment): boolean {
  if (!segment.text.startsWith(STATUS_SEPARATOR)) return false;
  const field = segment.text.slice(STATUS_SEPARATOR.length);
  if (field.length === 0 || field !== field.trim()) return false;
  if (hasControlChar(field) || codePointCount(field) > MAX_STATUS_FIELD_CHARS) return false;
  if (segment.dim !== true) return false;
  return segment.fg === undefined && segment.bg === undefined && segment.bold !== true;
}

/** The unstyled two-space indent Codex opens the row with. */
function isIndentSegment(segment: AnsiSegment): boolean {
  if (segment.text !== STATUS_INDENT) return false;
  if (segment.fg !== undefined || segment.bg !== undefined) return false;
  return (
    segment.bold !== true &&
    segment.dim !== true &&
    segment.italic !== true &&
    segment.underline !== true
  );
}

/** Trailing renderer padding is FOLDED, not matched: whitespace-only tail segments are dropped
 *  and the last surviving segment is rstripped, the same normalisation `rstrip` does to text.
 *  Returns null when nothing survives. */
function foldTrailingPadding(segments: AnsiSegment[]): AnsiSegment[] | null {
  let end = segments.length;
  while (end > 0 && segments[end - 1]!.text.trim() === "") end--;
  if (end === 0) return null;
  const last = segments[end - 1]!;
  const folded = segments.slice(0, end);
  folded[end - 1] = { ...last, text: rstrip(last.text) };
  return folded;
}

/**
 * A native status row, recognised by its PAINT. All of these must hold, or the row is
 * refused: the styled line must be the same row as `text`; the segments must read as an unstyled
 * two-space indent then `field (sep field)*`, optionally ending with one combined dim
 * `sep + field` segment after two ordinary fields; and the field count must stay in bounds. Prose
 * that happens to contain ` \u00b7 ` fails on the paint, which is the whole point of the guard.
 */
function isStyledStatusRow(text: string, line: StyledLine): boolean {
  const rowText = rstrip(text);
  if (rstrip(lineText(line)) !== rowText) return false;
  if (hasControlChar(rowText)) return false;
  if (codePointCount(rowText) > MAX_STATUS_ROW_CHARS) return false;

  const segments = foldTrailingPadding(line.segments);
  if (segments === null) return false;
  if (!isIndentSegment(segments[0]!)) return false;

  let fields = 0;
  let i = 1;
  while (i < segments.length) {
    if (!isFieldSegment(segments[i]!)) return false;
    fields++;
    i++;
    if (i === segments.length) break;

    const separator = segments[i]!;
    if (isDimSuffixFieldSegment(separator)) {
      if (fields < MIN_STATUS_FIELDS || i !== segments.length - 1) return false;
      fields++;
      i++;
      break;
    }
    if (!isSeparatorSegment(separator) || i === segments.length - 1) return false;
    i++;
  }
  return fields >= MIN_STATUS_FIELDS && fields <= MAX_STATUS_FIELDS;
}

/** True when the row could be the composer's status line. Never decisive alone — the composer
 *  is located by the prompt-row-above-status shape at the buffer tail, not by any single row.
 *  `line` is the same row, styled; Context and working queue rows also have text shapes. */
export function isStatusRow(text: string, line?: StyledLine): boolean {
  const row = rstrip(text);
  if (STATUS_ROW.test(row) || INLINE_QUEUE_CONTEXT_ROW.test(row)) return true;
  return line !== undefined && isStyledStatusRow(text, line);
}

/**
 * Custom statuslines can contain one coloured item, several merged dim items, or the disabled
 * shortcut/context footer. Text and separators are configurable; only the native footer paint is
 * stable. This predicate is NEVER sufficient on its own: locateComposer also requires the dedicated
 * live arrow, continuous composer background and painted padding above and below the draft.
 */
export function isComposerStatusRow(text: string, line?: StyledLine): boolean {
  if (isStatusRow(text, line)) return true;
  if (!line || rstrip(text) !== rstrip(lineText(line))) return false;
  const row = rstrip(text);
  if (hasControlChar(row) || codePointCount(row) > MAX_STATUS_ROW_CHARS) return false;
  const segments = foldTrailingPadding(line.segments);
  if (!segments || segments.length < 2 || !isIndentSegment(segments[0]!)) return false;

  let hasField = false;
  for (const segment of segments.slice(1)) {
    const shortcutIcon = hasField && segment.text === "←" && segment.bold === true &&
      segment.fg !== undefined && segment.dim !== true;
    if (
      segment.bg !== undefined || (segment.bold === true && !shortcutIcon) || segment.italic === true ||
      segment.underline === true || segment.strike === true
    ) return false;
    if (!segment.text.trim()) {
      if (segment.fg !== undefined || segment.dim === true) return false;
      continue;
    }
    // Codex merges adjacent muted items into one segment, including their separators.
    const muted = segment.dim === true && segment.fg === undefined;
    const colored = segment.dim !== true && segment.fg !== undefined;
    if (!muted && !colored) return false;
    hasField = true;
  }
  return hasField;
}

export function isWorkingQueueRow(text: string): boolean {
  return WORKING_QUEUE_ROW.test(rstrip(text));
}

export function isWorkingContextRow(text: string): boolean {
  return WORKING_CONTEXT_ROW.test(rstrip(text));
}

// The `› ` prompt row. Column 0 — but transcript ECHOES of submitted messages paint the same
// prefix, so callers must only trust this at the located composer position.
const PROMPT = /^› (.*)$/;

/** Body of a `› ` prompt-shaped row (rstripped), or null when the line is not one. */
export function promptText(text: string): string | null {
  const m = PROMPT.exec(rstrip(text));
  return m === null ? null : m[1]!;
}

/** The empty composer's placeholder, captured verbatim; chrome also requires its dim renderer style. */
export const PLACEHOLDER = "Ask Codex to do anything";

/** Index of the last non-blank row in `texts`, or -1 when the buffer is all blank. */
export function lastNonBlankIndex(texts: string[]): number {
  let i = texts.length - 1;
  while (i >= 0 && isBlank(texts[i]!)) i--;
  return i;
}

// Codex separates every section of a screen — prompt/status, options/footer, question/options —
// with exactly one blank row (every 2026-08-22 capture). The gap helpers accept up to two so a
// repaint wobble doesn't refuse a healthy frame; more means the rows aren't one widget.
const MAX_SECTION_GAP = 2;

/** The nearest non-blank row at or above `i`, or -1 when the blank gap exceeds the bound. */
export function skipBlanksUp(texts: string[], i: number): number {
  let gap = 0;
  while (i >= 0 && isBlank(texts[i]!)) {
    i--;
    if (++gap > MAX_SECTION_GAP) return -1;
  }
  return i;
}

/** Join rstripped line text over `[from, to)` — the dialog signature the race guard compares. */
export function regionSignature(lines: StyledLine[], from: number, to: number): string {
  return lines
    .slice(from, to)
    .map((l) => rstrip(lineText(l)))
    .join("\n");
}
