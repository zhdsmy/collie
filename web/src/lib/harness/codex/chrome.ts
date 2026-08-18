import type { AnsiSegment } from "../../ansi";
import { isBlank, lineText, trimTrailingBlank, type StyledLine } from "../../blocks";

const PROMPT_MARKER = "›";
const MAX_COMPOSER_LINES = 100;
const CONTEXT_FIELD = /(?:^|\s)Context \d+% left(?:\s|$)/;
const QUEUE_HINT = /^tab to queue message$/i;
const QUEUE_CONTEXT = /^\d+% context left$/i;
const QUEUE_STATUS = /^tab to queue message\s+\d+% context left$/i;

interface ComposerMatch {
  top: number;
  prompt: number;
  bottom: number;
  statusStart: number;
  statusEnd: number;
}

function uniformBackground(line: StyledLine): string | null {
  let background: string | undefined;

  for (const segment of line.segments) {
    if (segment.text.length === 0) continue;
    if (segment.bg === undefined) return null;
    if (background !== undefined && segment.bg !== background) return null;
    background = segment.bg;
  }

  return background ?? null;
}

function startsWithPrompt(line: StyledLine): boolean {
  return lineText(line).trimStart().startsWith(PROMPT_MARKER);
}

function isRichStatusLine(line: StyledLine): boolean {
  const text = lineText(line).trim();
  return CONTEXT_FIELD.test(text) && text.split("·").length >= 3 && uniformBackground(line) === null;
}

function locateStatusStart(lines: StyledLine[], end: number): number | null {
  const last = lines[end - 1]!;
  const lastText = lineText(last).trim();
  if (isRichStatusLine(last) || (QUEUE_STATUS.test(lastText) && uniformBackground(last) === null)) {
    return end - 1;
  }

  const hint = lines[end - 2];
  if (
    hint !== undefined &&
    QUEUE_CONTEXT.test(lastText) &&
    QUEUE_HINT.test(lineText(hint).trim()) &&
    uniformBackground(last) === null &&
    uniformBackground(hint) === null
  ) {
    return end - 2;
  }

  return null;
}

function locateComposer(lines: StyledLine[]): ComposerMatch | null {
  let end = lines.length;
  while (end > 0 && isBlank(lineText(lines[end - 1]!)) && uniformBackground(lines[end - 1]!) === null) {
    end--;
  }
  if (end < 4) return null;

  const statusStart = locateStatusStart(lines, end);
  if (statusStart === null) return null;

  const bottom = statusStart - 1;
  const background = uniformBackground(lines[bottom]!);
  if (background === null || !isBlank(lineText(lines[bottom]!))) return null;

  let top = bottom;
  while (
    top > 0 &&
    bottom - top < MAX_COMPOSER_LINES &&
    uniformBackground(lines[top - 1]!) === background
  ) {
    top--;
  }

  const prompt = top + 1;
  if (bottom - top < 2 || !isBlank(lineText(lines[top]!)) || !startsWithPrompt(lines[prompt]!)) {
    return null;
  }

  for (let i = prompt + 1; i < bottom; i++) {
    if (startsWithPrompt(lines[i]!)) return null;
  }

  return { top, prompt, bottom, statusStart, statusEnd: end };
}

function draftSegments(line: StyledLine): AnsiSegment[] {
  const result: AnsiSegment[] = [];
  let markerSeen = false;

  for (const segment of line.segments) {
    if (markerSeen) {
      result.push(segment);
      continue;
    }

    const marker = segment.text.indexOf(PROMPT_MARKER);
    if (marker === -1) continue;
    markerSeen = true;
    const text = segment.text.slice(marker + PROMPT_MARKER.length).replace(/^\s/, "");
    if (text.length > 0) result.push({ ...segment, text });
  }

  return result;
}

/** Remove Codex's native composer and status rows when their complete tail shape is present. */
export function stripChrome(lines: StyledLine[]): StyledLine[] {
  const match = locateComposer(lines);
  return match === null ? lines : trimTrailingBlank(lines.slice(0, match.top));
}

/** Return Codex's styled status rows from immediately below its composer. */
export function extractStatusLines(lines: StyledLine[]): StyledLine[] {
  const match = locateComposer(lines);
  return match === null ? [] : lines.slice(match.statusStart, match.statusEnd);
}

/** Return the visible Codex draft, excluding its dim rotating placeholder. */
export function extractInputDraft(lines: StyledLine[]): string | null {
  const match = locateComposer(lines);
  if (match === null) return null;

  const first = draftSegments(lines[match.prompt]!);
  const continuation = lines.slice(match.prompt + 1, match.bottom).flatMap((line) => line.segments);
  const content = [...first, ...continuation].filter((segment) => segment.text.trim().length > 0);
  if (content.length === 0 || content.every((segment) => segment.dim === true)) return null;

  const rows = [first.map((segment) => segment.text).join(""), ...lines
    .slice(match.prompt + 1, match.bottom)
    .map(lineText)]
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  return rows.length === 0 ? null : rows.join(" ");
}
