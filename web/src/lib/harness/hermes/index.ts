import type { AnsiSegment } from "../../ansi";
import { lineText, trimTrailingBlank, type Block, type StyledLine } from "../../blocks";
import type { HarnessAdapter } from "../types";

// Display-only Hermes CLI chrome, verified against the 2026-09-10 ANSI capture and the official
// cli_stream_mixin / cli_status_bar_mixin renderers. No dialog or send recipe is inferred here.
const RULE = /^─{8,}$/u;
const RESPONSE_TOP = /^╭─\s*(⚕\s*Hermes(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\s*─{8,}╮$/u;
const RESPONSE_BOTTOM = /^╰─{8,}╯$/u;
const STATUS_HEAD = /^\s*⚕\s+\S/u;
const CONTEXT = /(?:ctx\s+--|~?[\d.]+[KMB]?\/[\d.]+[KMB]?|\[[█░]+\]\s*(?:~?\d+(?:\.\d+)?%|--))/u;

function sliceSegments(segments: AnsiSegment[], start: number, end: number): AnsiSegment[] {
  let offset = 0;
  return segments.flatMap((segment) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(segment.text.length, end - offset);
    offset += segment.text.length;
    return from < to ? [{ ...segment, text: segment.text.slice(from, to) }] : [];
  });
}

interface Footer {
  statusStart: number;
  top: number;
  empty: boolean;
}

function locateFooter(lines: StyledLine[]): Footer | null {
  const texts = lines.map(lineText);
  let bottom = texts.length - 1;
  while (bottom >= 0 && texts[bottom]!.trim() === "") bottom--;
  if (bottom < 2 || !RULE.test(texts[bottom]!.trim())) return null;
  for (let prompt = bottom - 1; prompt >= Math.max(1, bottom - 100); prompt--) {
    const text = texts[prompt]!;
    if (RULE.test(text.trim())) return null;
    if (!/^❯(?: |$)/u.test(text)) continue;
    const top = prompt - 1;
    if (!RULE.test(texts[top]!.trim()) || texts[top]!.trim() !== texts[bottom]!.trim()) return null;
    if (texts.slice(prompt + 1, bottom).some((row) => row.trim() && !/^ {2}/u.test(row))) return null;
    for (let statusStart = top - 1; statusStart >= Math.max(0, top - 4); statusStart--) {
      if (!STATUS_HEAD.test(texts[statusStart]!)) continue;
      const status = texts.slice(statusStart, top).join(" ");
      if (!status.includes("│") || !CONTEXT.test(status)) return null;
      const draft = sliceSegments(lines[prompt]!.segments, 2, text.length);
      // Suggestions are italic. Real drafts remain visible until their editing/submit contract
      // is verified; hiding someone else's typed text would lose it.
      const empty = draft.every((s) => !s.text.trim() || s.italic) &&
        texts.slice(prompt + 1, bottom).every((row) => !row.trim());
      return { statusStart, top, empty };
    }
    return null;
  }
  return null;
}

function fitResponseRule(line: StyledLine): StyledLine {
  const text = lineText(line);
  const end = text.length - 1;
  const start = /─+[╮╯]$/u.exec(text)?.index;
  if (start === undefined) return line;
  const leading = sliceSegments(line.segments, 0, start);
  const rule = sliceSegments(line.segments, start, end);
  const trailing = sliceSegments(line.segments, end, text.length);
  return {
    ...line,
    segments: [...leading, ...rule, ...trailing],
    fitRule: { start: leading.length, end: leading.length + rule.length },
  };
}

function responseChrome(lines: StyledLine[], closingWidth: number): StyledLine[] {
  let responseWidth = 0;
  return lines.map((line, index) => {
    const text = lineText(line);
    const header = RESPONSE_TOP.exec(text);
    if (header?.[1]) {
      responseWidth = text.length;
      return fitResponseRule(line);
    }
    const matchesClosing = (responseWidth > 0 && text.length === responseWidth) ||
      (index === lines.length - 1 && text.length === closingWidth);
    if (matchesClosing && RESPONSE_BOTTOM.test(text)) {
      responseWidth = 0;
      return fitResponseRule(line);
    }
    return line;
  });
}

export function hermesBuildBlocks(lines: StyledLine[]): Block[] {
  const footer = locateFooter(lines);
  const content = footer
    ? [...lines.slice(0, footer.statusStart), ...(footer.empty ? [] : lines.slice(footer.top))]
    : lines;
  const closingWidth = footer?.empty ? lineText(lines[footer.top]!).trim().length : 0;
  return [{ kind: "raw", lines: responseChrome(trimTrailingBlank(content), closingWidth) }];
}

export function extractStatusLines(lines: StyledLine[]): StyledLine[] {
  const footer = locateFooter(lines);
  if (!footer) return [];
  const segments = lines.slice(footer.statusStart, footer.top).flatMap((line) => line.segments);
  const background = segments.find((s) => s.bg)?.bg;
  return [{ segments: segments.map((segment) => {
    // The title is inverse video: its former background is the readable accent, not its ink.
    const fg = segment.bg && segment.bg !== background ? segment.bg : segment.fg;
    const { backgroundColor: _background, ...style } = segment.style;
    return Object.assign({}, segment, { fg, bg: undefined, style: { ...style, color: fg } });
  }) }];
}

export const hermesAdapter: HarnessAdapter = {
  agent: "hermes",
  displayOnly: true,
  buildBlocks: hermesBuildBlocks,
  extractStatusLines,
  extractInputDraft: () => null,
};
