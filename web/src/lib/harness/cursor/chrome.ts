import { isBlank, lineText, trimTrailingBlank, type StyledLine } from "../../blocks";

const INPUT_BACKGROUND = "rgb(39,39,52)";
const MAX_STATUS_ROWS = 2;
const MAX_INPUT_ROWS = 100;

interface CursorChrome {
  inputStart: number;
  promptRow: number;
  inputEnd: number;
  statusStart: number;
  statusEnd: number;
}

function paintedLength(line: StyledLine, background: string): number {
  return line.segments.reduce(
    (length, segment) => length + (segment.bg === background ? segment.text.length : 0),
    0,
  );
}

function inputFill(line: StyledLine): boolean {
  const text = lineText(line);
  return paintedLength(line, INPUT_BACKGROUND) >= Math.max(1, text.length - 2);
}

function locateChrome(lines: StyledLine[]): CursorChrome | null {
  let statusEnd = lines.length;
  while (statusEnd > 0 && isBlank(lineText(lines[statusEnd - 1]!))) statusEnd--;
  if (statusEnd === 0) return null;

  let statusStart = statusEnd;
  while (
    statusStart > 0 &&
    statusEnd - statusStart < MAX_STATUS_ROWS &&
    !isBlank(lineText(lines[statusStart - 1]!))
  ) {
    statusStart--;
  }
  if (statusStart === statusEnd) return null;

  let inputEnd = statusStart;
  // Cursor separates status from the box with unpainted whitespace; the box's own bottom row is
  // blank too, so style is the only thing that keeps this walk from swallowing the anchor itself.
  while (
    inputEnd > 0 &&
    isBlank(lineText(lines[inputEnd - 1]!)) &&
    !inputFill(lines[inputEnd - 1]!)
  ) {
    inputEnd--;
  }
  if (inputEnd === 0 || !inputFill(lines[inputEnd - 1]!)) return null;

  let inputStart = inputEnd;
  while (
    inputStart > 0 &&
    inputEnd - inputStart < MAX_INPUT_ROWS &&
    inputFill(lines[inputStart - 1]!)
  ) {
    inputStart--;
  }
  if (inputEnd - inputStart < 3) return null;
  if (!isBlank(lineText(lines[inputStart]!)) || !isBlank(lineText(lines[inputEnd - 1]!))) return null;

  let promptRow = -1;
  for (let i = inputStart + 1; i < inputEnd - 1; i++) {
    if (/^\s*→(?:\s|$)/u.test(lineText(lines[i]!))) {
      if (promptRow !== -1) return null;
      promptRow = i;
    }
  }
  if (promptRow === -1) return null;
  return { inputStart, promptRow, inputEnd, statusStart, statusEnd };
}

/** Remove only a complete Cursor input/status tail; unmatched output stays byte-for-byte visible. */
export function stripChrome(lines: StyledLine[]): StyledLine[] {
  const chrome = locateChrome(lines);
  return chrome === null ? lines : trimTrailingBlank(lines.slice(0, chrome.inputStart));
}

/** Cursor paints one or two status rows below its input box. Re-surface them in Collie's fixed strip. */
export function extractStatusLines(lines: StyledLine[]): StyledLine[] {
  const chrome = locateChrome(lines);
  if (chrome === null) return [];
  return lines
    .slice(chrome.statusStart, chrome.statusEnd)
    .filter((line) => !isBlank(lineText(line)));
}

/**
 * Return a real typed draft, but not Cursor's dim generated follow-up suggestion. Cursor inverts one
 * glyph for the caret, so a ghost may have one non-dim character; any further non-dim body is typed.
 */
export function extractInputDraft(lines: StyledLine[]): string | null {
  const chrome = locateChrome(lines);
  if (chrome === null) return null;
  const prompt = lines[chrome.promptRow]!;
  const text = lineText(prompt);
  const marker = text.indexOf("→");
  if (marker < 0) return null;
  const body = text.slice(marker + 1).replace(/\s*ctrl\+c to stop\s*$/u, "").trim();
  if (body === "") return null;

  let offset = 0;
  let nonDim = 0;
  for (const segment of prompt.segments) {
    const start = offset;
    offset += segment.text.length;
    if (offset <= marker + 1 || segment.text.trim() === "") continue;
    const visible = segment.text.slice(Math.max(0, marker + 1 - start)).trim();
    if (visible !== "" && segment.dim !== true) nonDim += visible.length;
  }
  return nonDim > 1 ? body : null;
}
