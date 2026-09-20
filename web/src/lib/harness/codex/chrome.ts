// Codex's boxless composer is anchored by its live prompt and status footer; dialogs replace
// that pair. Normalize only a proven painted particle band, using the same helper as the bridge,
// so animation cannot change a bound draft. Keep the working/custom footer and exact-command
// completion guards. Upstream's bandTop removes particle-only rows above the prompt with the
// composer; it uses the local normalization proof rather than classifying typed Braille by glyph.

import type { StyledLine } from "../../blocks";
import { normalizeComposerParticles } from "./particles";
import {
  isBlank,
  isComposerStatusRow,
  isWorkingContextRow,
  isWorkingQueueRow,
  isStatusRow,
  lastNonBlankIndex,
  lineText,
  PLACEHOLDER,
  promptText,
  rstrip,
  skipBlanksUp,
} from "./markers";

export interface ComposerBox {
  /** First row of the composer band: the prompt row, or the starfield rows directly above it. */
  top: number;
  /** The `› ` prompt row. */
  promptRow: number;
  /** The status row under it (last non-blank row of the frame). */
  statusRow: number;
}

// A draft wraps onto indented continuation rows between the prompt row and the status row.
// Captured drafts show one; the bound is slack for longer phone-typed messages. 8 stranded a
// wrap (locateComposer returned null and the app reported a dialog). Same 100 as omp/Grok/
// Claude. A defence bound (see the header): a prompt row further up than this is not searched for,
// and locateComposer fails closed.
const MAX_DRAFT_ROWS = 100;

// A continuation starts with Codex's two-space gutter; the draft may add its own indent.
// Empty paragraphs are handled separately by the bounded walk below. Column-zero output
// (including tool/answer bullets) still cannot be crossed on the way to the live prompt.
const CONTINUATION = /^ {2}\s*\S/;
const PROMPT_PREFIX = "› ";

/**
 * The live Codex composer paints its prompt arrow as a dedicated bold segment and fills the whole
 * composer row with one background. Picker selections also use a bold arrow, but keep the option
 * text in the same segment; submitted echoes are dim and unpainted. Advanced reasoning may color
 * the live arrow amber. This distinction is the proof
 * needed by the broad 0.150.1 footer grammars, whose text is intentionally configurable.
 */
function hasComposerChrome(lines: StyledLine[], promptRow: number, statusRow: number): boolean {
  const prompt = lines[promptRow];
  const marker = prompt?.segments[0];
  if (
    marker?.text !== "›" ||
    marker.bold !== true ||
    marker.dim === true ||
    marker.bg === undefined
  ) {
    return false;
  }

  const background = marker.bg;
  if (!prompt.segments.every((segment) => segment.bg === background)) return false;

  // A blank painted row above the prompt and another immediately before the footer are part of
  // Codex's boxless composer. Requiring both prevents a modal's dim footer from borrowing a live
  // prompt-looking option row as its input anchor.
  const isPadding = (line: StyledLine | undefined): boolean =>
    line !== undefined &&
    line.segments.length > 0 &&
    line.segments.every((segment) => segment.bg === background && segment.text.trim() === "");
  return isPadding(lines[promptRow - 1]) && isPadding(lines[statusRow - 1]);
}

/** The exact placeholder text is still a valid thing an operator might deliberately type. Codex
 * distinguishes its empty hint by painting the whole body dim, so extraction should use that
 * renderer evidence too instead of discarding an ordinary non-dim draft with those words. */
function isEmptyPlaceholder(line: StyledLine): boolean {
  const text = rstrip(lineText(line));
  if (promptText(text) !== PLACEHOLDER) return false;

  const bodyStart = PROMPT_PREFIX.length;
  const bodyEnd = bodyStart + PLACEHOLDER.length;
  let offset = 0;
  let sawBody = false;
  for (const segment of line.segments) {
    const next = offset + segment.text.length;
    if (Math.max(offset, bodyStart) < Math.min(next, bodyEnd)) {
      sawBody = true;
      if (segment.dim !== true) return false;
    }
    offset = next;
    if (offset >= bodyEnd) break;
  }
  return sawBody;
}

/** A complete slash command opens a completion list IN PLACE OF the status row. It is still
 * the composer, not a modal. Recognize only the exact command selected in the tail's suggestions;
 * an incomplete search, arguments, transcript echo or a different dialog cannot authorize Enter.
 * Keep the whole region for the bridge binding, including the suggestions below the input. */
function commandInput(lines: StyledLine[]): { draft: string; prompt: string } | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const end = lastNonBlankIndex(texts);
  let selected: string | null = null;
  let i = end;
  for (; i >= 0 && end - i < MAX_DRAFT_ROWS; i--) {
    const command = /^ {2}(\/[a-z][a-z0-9_-]*) {2,}\S/.exec(texts[i]!);
    if (!command) break;
    // Codex paints the selected row bold throughout; an unselected row only bolds search
    // matches within its name and dims its description. Enter acts on that selected row.
    if (lines[i]!.segments.filter((s) => s.text.trim()).every((s) => s.bold && !s.dim)) {
      if (selected !== null) return null;
      selected = command[1]!;
    }
  }
  if (selected === null) return null;
  const promptRow = skipBlanksUp(texts, i);
  if (promptRow < 0) return null;
  const draft = promptText(texts[promptRow]!)?.trim();
  if (!draft || draft !== selected) return null;
  const marker = lines[promptRow]!.segments.find((segment) => segment.text.startsWith("›"));
  if (!marker?.bold || marker.dim) return null;
  return { draft, prompt: texts.slice(promptRow, end + 1).join("\n") };
}

/** The composer with a status footer. Command completion is recognized separately below. */
export function locateComposer(lines: StyledLine[]): ComposerBox | null {
  const original = lines;
  lines = normalizeComposerParticles(lines);
  const texts = lines.map((l) => rstrip(lineText(l)));
  const statusRow = lastNonBlankIndex(texts);
  if (statusRow < 0) return null;
  const regularStatus = isComposerStatusRow(texts[statusRow]!, lines[statusRow]);
  const workingStatus = isWorkingContextRow(texts[statusRow]!);
  const customStatus =
    !workingStatus && !isStatusRow(texts[statusRow]!, lines[statusRow]);
  if (!regularStatus && !workingStatus) return null;

  // Separate layout padding from the draft. Internal empty paragraphs are valid, but crossing one
  // requires the live marker's paint so a dim submitted echo cannot claim later output. The newer
  // custom footer shapes below have their own stricter marker/background proof even without a gap.
  let top = statusRow - 1;
  // A normalized starfield can occupy more rows than a transcript section's short blank gap.
  while (top >= 0 && statusRow - top <= MAX_DRAFT_ROWS && isBlank(texts[top]!)) top--;
  if (top < 0 || statusRow - top > MAX_DRAFT_ROWS) return null;
  // A working footer is valid only as the exact queue-hint + context pair. This prevents a
  // transcript line that happens to end in `50% context left` from becoming an input box.
  if (workingStatus && !isWorkingQueueRow(texts[top]!)) return null;
  let crossedBlank = false;
  for (let i = top; i >= 0 && statusRow - 1 - i <= MAX_DRAFT_ROWS; i--) {
    const t = texts[i]!;
    if (promptText(t) !== null) {
      if (crossedBlank && !workingStatus && !customStatus) {
        const marker = lines[i]!.segments.find((segment) => segment.text.startsWith("›"));
        if (!marker?.bold || marker.dim) return null;
      }
      if (customStatus && !hasComposerChrome(lines, i, statusRow)) return null;
      return { top: bandTop(original, texts, i), promptRow: i, statusRow };
    }
    if (isBlank(t)) {
      crossedBlank = true;
      continue;
    }
    if (workingStatus && i === top && isWorkingQueueRow(t)) continue;
    if (!CONTINUATION.test(t) || isStatusRow(t, lines[i])) return null;
  }
  return null;
}

/** The starfield rows directly above the prompt belong to the composer band, and leave the mirror
 *  with it. Only a row that holds sparkles and nothing else: such a row is never transcript. */
function bandTop(lines: StyledLine[], texts: string[], promptRow: number): number {
  let top = promptRow;
  while (
    top > 0 &&
    promptRow - top < MAX_DRAFT_ROWS &&
    isBlank(texts[top - 1]!) &&
    !isBlank(lineText(lines[top - 1]!))
  ) {
    top--;
  }
  return top;
}

/**
 * Return `lines` with the composer (its band through the status row) removed from the tail.
 * Unchanged input is the SAME REFERENCE, so callers can treat `result === lines` as "no chrome".
 */
export function stripChrome(lines: StyledLine[]): StyledLine[] {
  const box = locateComposer(lines);
  if (box === null) return lines;
  return lines.slice(0, box.top);
}

/** The status row, styled, for the strip above the phone composer. Empty when no composer. */
export function extractStatusLines(lines: StyledLine[]): StyledLine[] {
  const box = locateComposer(lines);
  if (box === null) return [];
  return [lines[box.statusRow]!];
}

/**
 * The user's draft stranded in the composer: the `› ` row's text plus wrapped continuation
 * rows, joined with single spaces (Codex word-wraps — verified against the typed original on
 * the draft-wrapped capture). The placeholder is not a draft. Null = no composer / empty.
 * Sparkles are painted over first, and a blank row between the prompt and the status row is skipped.
 *
 * Load-bearing: registering this adapter switches Codex panes from one-shot send to
 * type-then-verify, and THIS is the verify half.
 */
export function extractInputDraft(lines: StyledLine[]): string | null {
  lines = normalizeComposerParticles(lines);
  const box = locateComposer(lines);
  if (box === null) return commandInput(lines)?.draft ?? null;
  const texts = lines.map((l) => rstrip(lineText(l)));
  const first = promptText(texts[box.promptRow]!) ?? "";
  const parts = [first.trim()];
  const workingStatus = isWorkingContextRow(texts[box.statusRow]!);
  for (let i = box.promptRow + 1; i < box.statusRow; i++) {
    if (workingStatus && isWorkingQueueRow(texts[i]!)) continue;
    parts.push(texts[i]!.trim());
  }
  const draft = parts.filter((p) => p !== "").join(" ");
  if (draft === "" || (draft === PLACEHOLDER && isEmptyPlaceholder(lines[box.promptRow]!))) {
    return null;
  }
  return draft;
}

/** Typing reaches the composer only when the composer is on screen — every dialog replaces it. */
export function composerReady(lines: StyledLine[]): boolean {
  return locateComposer(lines) !== null || commandInput(normalizeComposerParticles(lines)) !== null;
}

/** The literal on-screen prompt/draft run a destructive write is bound to. Ending at the last draft
 * continuation keeps a wrapped message inside the bridge's bounded tail window; naming only the
 * first `›` row would permanently 409 once six or more non-blank wrap rows sat beneath it.
 * Particle spaces use the same normalization in the bridge, so animated drafts stay bound. */
export function composerPrompt(lines: StyledLine[]): string | null {
  lines = normalizeComposerParticles(lines);
  const box = locateComposer(lines);
  if (box === null) return commandInput(lines)?.prompt ?? null;
  let end = box.statusRow;
  while (end > box.promptRow + 1 && isBlank(lineText(lines[end - 1]!))) end--;
  return lines
    .slice(box.promptRow, end)
    .map((line) => rstrip(lineText(line)))
    .join("\n");
}
