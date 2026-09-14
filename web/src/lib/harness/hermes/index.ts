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
/** A frame border whose row cannot carry its closing corner: the pane cut it. See {@link rejoinWrappedBorders}. */
const BORDER_OPEN = /^(?:╭─\s*⚕\s*Hermes|╰─{8,})/u;
/** What such a border continues onto — the rest of the dashes, corner last. */
const BORDER_TAIL = /^─{8,}[╮╯]?$/u;
/** Rows one border may be spread over before it stops looking like a border. */
const BORDER_MAX_ROWS = 4;

function sliceSegments(segments: AnsiSegment[], start: number, end: number): AnsiSegment[] {
  let offset = 0;
  return segments.flatMap((segment) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(segment.text.length, end - offset);
    offset += segment.text.length;
    return from < to ? [{ ...segment, text: segment.text.slice(from, to) }] : [];
  });
}

/** A frame segment keeps the terminal's ink: see the note in {@link fitResponseRule}. */
function keepSkinInk(segment: AnsiSegment): AnsiSegment {
  return { ...segment, muted: false };
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
  // THE FRAME IS THE SKIN'S LINE, NOT APP CHROME. `checkMuted` (lib/ansi.ts) sees a row of nothing
  // but rule glyphs and marks it decorative, which mirror-space.ts repaints neutral — right for a
  // separator, wrong for a border the terminal painted in its accent. It showed as a message whose
  // TOP border was gold and whose BOTTOM one was grey, and on a wrapped frame as a gold line that
  // turned grey halfway along (measured on the operator's pane, 2026-09-14). Clear the flag here:
  // this row is adapter-verified as a frame, which is exactly the context the parser lacks.
  const leading = sliceSegments(line.segments, 0, start).map(keepSkinInk);
  const rule = sliceSegments(line.segments, start, end).map(keepSkinInk);
  const trailing = sliceSegments(line.segments, end, text.length).map(keepSkinInk);
  return {
    ...line,
    segments: [...leading, ...rule, ...trailing],
    fitRule: { start: leading.length, end: leading.length + rule.length },
  };
}

/**
 * Put a frame border the PANE cut back on one row.
 *
 * A frame is drawn at the width of the terminal that was on screen when the message completed, and
 * Herdr re-wraps those scrollback rows at whatever width the pane has NOW — so a frame from a wider
 * window (measured: a 211-column frame read back from a 160-column pane) arrives as its own
 * continuation: `╭─ ⚕ Hermes ───…` on one row, `───…╮` on the next.
 *
 * Every pattern below is anchored to a whole row, so such a border reads as ordinary dashes, the
 * frame is never fitted, and the operator is left with the box's leftovers — a stray `╮` at the
 * start of the message and a `╯` at the end, which is exactly what the fitting exists to remove.
 *
 * The rows it was cut over are EMPTIED rather than deleted. Source-row indices must keep lining up
 * with the screen (`latest-reply` maps a reply's last row onto this array before hiding it), and a
 * blank row where the wrap was is the cheapest price for that; the border's own corner travels onto
 * the joined row, so nothing the operator was meant to see is lost.
 */
function rejoinWrappedBorders(lines: StyledLine[]): StyledLine[] {
  const joined = [...lines];
  for (let top = 0; top < joined.length - 1; top++) {
    const opening = lineText(joined[top]!);
    if (!BORDER_OPEN.test(opening) || /[╮╯]$/u.test(opening)) continue;
    const segments = [...joined[top]!.segments];
    let bottom = top;
    while (bottom + 1 < joined.length && bottom - top < BORDER_MAX_ROWS) {
      const next = lineText(joined[bottom + 1]!);
      if (!BORDER_TAIL.test(next)) break;
      bottom++;
      segments.push(...joined[bottom]!.segments);
      if (/[╮╯]$/u.test(next)) break;
    }
    // Only a border that reaches its corner is a border. Anything else was dashes that happened to
    // follow one, and guessing there would eat a rule the operator was meant to read.
    if (bottom === top || !/[╮╯]$/u.test(lineText(joined[bottom]!))) continue;
    // Reaching the corner is proof enough to fit it: this is a frame, whether or not the row that
    // opened it is still on screen — and a lone closing border left as raw dashes is the very
    // leftover the fitting exists to remove.
    joined[top] = fitResponseRule({ ...joined[top]!, segments });
    for (let i = top + 1; i <= bottom; i++) joined[i] = { ...joined[i]!, segments: [] };
    top = bottom;
  }
  return joined;
}

function responseChrome(lines: StyledLine[], closingWidth: number): StyledLine[] {
  let responseWidth = 0;
  return rejoinWrappedBorders(lines).map((line, index, all) => {
    const text = lineText(line);
    const header = RESPONSE_TOP.exec(text);
    if (header?.[1]) {
      responseWidth = text.length;
      return fitResponseRule(line);
    }
    const matchesClosing = (responseWidth > 0 && text.length === responseWidth) ||
      (index === all.length - 1 && text.length === closingWidth);
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
