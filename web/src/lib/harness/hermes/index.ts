import type { AnsiSegment } from "../../ansi";
import { lineText, trimTrailingBlank, type Block, type StyledLine } from "../../blocks";
import type { HarnessAdapter } from "../types";
import { decorateHermesDiff } from "./display";
import { detectClarify } from "./clarify";

// Hermes chrome and verified clarify cards. Ordinary text replies retain their existing
// transport; clarify option digits use the shared fresh-dialog guard.
const RULE = /^─{8,}$/u;
const RESPONSE_TOP = /^╭─\s*(⚕\s*Hermes(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\s*─{8,}╮$/u;
const RESPONSE_BOTTOM = /^╰─{8,}╯$/u;
const STATUS_HEAD = /^\s*⚕\s+\S/u;
const CONTEXT = /(?:ctx\s+--|~?[\d.]+[KMB]?\/[\d.]+[KMB]?|\[[█░]+\]\s*(?:~?\d+(?:\.\d+)?%|--))/u;
const WORKING_HINT = "msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel";

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
  clarify: boolean;
  hint?: StyledLine;
}

function locateFooter(lines: StyledLine[]): Footer | null {
  const texts = lines.map(lineText);
  let bottom = texts.length - 1;
  while (bottom >= 0 && texts[bottom]!.trim() === "") bottom--;
  if (bottom < 2 || !RULE.test(texts[bottom]!.trim())) return null;
  for (let prompt = bottom - 1; prompt >= Math.max(1, bottom - 100); prompt--) {
    const text = texts[prompt]!;
    if (RULE.test(text.trim())) return null;
    // The default working prompt adds ⚕; minimal chrome omits the ❯ suffix.
    const promptMatch = /^(?:❯(?: |$)|[⚕?✎] (?:❯(?: |$))?)/u.exec(text);
    if (!promptMatch) continue;
    const top = prompt - 1;
    if (!RULE.test(texts[top]!.trim()) || texts[top]!.trim() !== texts[bottom]!.trim()) return null;
    const draft = sliceSegments(lines[prompt]!.segments, promptMatch[0].length, text.length);
    const continuation = lines.slice(prompt + 1, bottom).flatMap((line) => line.segments);
    const input = [...draft, ...continuation];
    // Only this verified italic placeholder is lifted. Match through physical wrapping without
    // attempting to reflow arbitrary input, and never mistake a typed copy for a placeholder.
    const placeholder = input.find((s) => s.text.trim());
    const hint = text.startsWith("⚕ ") && placeholder && input.every((s) => !s.text.trim() || s.italic) &&
      input.map((s) => s.text).join("").replace(/\s/gu, "") === WORKING_HINT.replace(/\s/gu, "")
      ? { segments: [{ ...placeholder, text: WORKING_HINT }] } : undefined;
    if (!hint && texts.slice(prompt + 1, bottom).some((row) => row.trim() && !/^ {2}/u.test(row))) return null;
    for (let statusStart = top - 1; statusStart >= Math.max(0, top - 4); statusStart--) {
      if (!STATUS_HEAD.test(texts[statusStart]!)) continue;
      const status = texts.slice(statusStart, top).join(" ");
      if (!status.includes("│") || !CONTEXT.test(status)) return null;
      // Suggestions are italic. Real drafts remain visible until their editing/submit contract
      // is verified; hiding someone else's typed text would lose it.
      const empty = !!hint || (text.startsWith("⚕ ")
        ? input.every((s) => !s.text.trim())
        : draft.every((s) => !s.text.trim() || s.italic) && continuation.every((s) => !s.text.trim()));
      return { statusStart, top, empty, hint, clarify: text.startsWith("? ") };
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

function inputChrome(lines: StyledLine[]): StyledLine[] {
  const result = [...lines];
  for (let top = 0; top < lines.length - 2; top++) {
    const rule = lineText(lines[top]!).trim();
    const prompt = lines[top + 1]!;
    if (!RULE.test(rule) || !lineText(prompt).startsWith("● ")) continue;
    if (!prompt.segments.find((s) => s.text.includes("●"))?.bold) continue;
    if (prompt.segments.some((s) => s.text.trim() && !s.bold && !s.dim)) continue;
    // Submitted input is bold, with optional dim timestamps/omitted-line notices. A matching
    // pair around that preview is chrome; ordinary rules and response-body bullets remain raw.
    for (let bottom = top + 2; bottom < lines.length; bottom++) {
      const line = lines[bottom]!;
      if (lineText(line).trim() === rule) {
        result[top] = { ...lines[top]!, fullWidthRule: true };
        result[bottom] = { ...line, fullWidthRule: true };
        top = bottom;
        break;
      }
      if (line.segments.some((s) => s.text.trim() && !s.bold && !s.dim)) break;
    }
  }
  return result;
}

export function hermesBuildBlocks(lines: StyledLine[]): Block[] {
  const footer = locateFooter(lines);
  const clarify = footer?.clarify && footer.empty ? detectClarify(lines, footer.statusStart) : null;
  if (clarify) {
    const before = trimTrailingBlank(lines.slice(0, clarify.start));
    return [
      { kind: "raw", lines: [...decorateHermesDiff(inputChrome(responseChrome(before, 0))), ...clarify.questionLines] },
      { kind: "prompt-select", prompt: clarify.model, lines: lines.slice(clarify.start) },
    ];
  }
  const content = footer
    ? [...lines.slice(0, footer.statusStart), ...(footer.empty ? [] : lines.slice(footer.top))]
    : lines;
  const closingWidth = footer?.empty ? lineText(lines[footer.top]!).trim().length : 0;
  return [{ kind: "raw", lines: decorateHermesDiff(inputChrome(responseChrome(trimTrailingBlank(content), closingWidth))) }];
}

export function extractStatusLines(lines: StyledLine[]): StyledLine[] {
  const footer = locateFooter(lines);
  if (!footer) return [];
  const segments = lines.slice(footer.statusStart, footer.top).flatMap((line) => line.segments);
  const background = segments.find((s) => s.bg)?.bg;
  const rows = [{ segments }, ...(footer.hint ? [footer.hint] : [])];
  return rows.map((row) => ({ segments: row.segments.map((segment) => {
    // The title is inverse video: its former background is the readable accent, not its ink.
    const fg = segment.bg && segment.bg !== background ? segment.bg : segment.fg;
    const { backgroundColor: _background, ...style } = segment.style;
    return Object.assign({}, segment, { fg, bg: undefined, style: { ...style, color: fg } });
  }) }));
}

export const hermesAdapter: HarnessAdapter = {
  agent: "hermes",
  displayOnly: true,
  buildBlocks: hermesBuildBlocks,
  extractStatusLines,
  extractInputDraft: () => null,
};
