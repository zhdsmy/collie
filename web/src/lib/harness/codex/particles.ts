import type { AnsiSegment } from "../../ansi";
import { lineText, type StyledLine } from "../../blocks";
import { isStatusRow, lastNonBlankIndex } from "./markers";

// Codex 0.154 paints single-dot Braille particles into SPACE cells, including spaces inside
// real drafts. Each particle has its own RGB ink on the composer background. Typed Braille
// keeps the text area's normal ink; matching the glyph alone would corrupt real input.
const PARTICLE = /^[⠁⠂⠄⠈⠐⠠⡀⢀]+$/u;

function isParticle(segment: AnsiSegment, background: string): boolean {
  return segment.bg === background && segment.fg?.startsWith("rgb(") === true
    && !segment.bold && !segment.dim && !segment.italic && !segment.underline && !segment.strike
    && PARTICLE.test(segment.text);
}

function hasBackground(line: StyledLine, background: string): boolean {
  return line.segments.length > 0 && line.segments.every((s) => s.bg === background);
}

function isPadding(line: StyledLine, background: string): boolean {
  return hasBackground(line, background)
    && line.segments.every((s) => s.text.trim() === "" || isParticle(s, background));
}

/** Normalize only a complete, painted Codex composer at the live status tail. Keeps row and
 * character offsets: particles were spaces, so replace them with spaces, never delete them.
 * This same pure function also runs in the bridge before comparing a bound input region. */
export function normalizeComposerParticles(lines: StyledLine[]): StyledLine[] {
  const status = lastNonBlankIndex(lines.map(lineText));
  if (status < 3 || !isStatusRow(lineText(lines[status]!), lines[status])) return lines;
  const bottom = status - 1;
  const background = lines[bottom]!.segments[0]?.bg;
  if (!background || !isPadding(lines[bottom]!, background)) return lines;
  let top = bottom;
  while (top > 0 && bottom - top < 100 && hasBackground(lines[top - 1]!, background)) top--;
  if (top + 2 > bottom || !isPadding(lines[top]!, background)) return lines;
  const marker = lines[top + 1]!.segments[0];
  if (!marker?.text.startsWith("›") || !marker.bold || marker.dim) return lines;
  let changed = false;
  const result = lines.map((line, index) => {
    if (index < top || index > bottom || !line.segments.some((s) => isParticle(s, background))) return line;
    changed = true;
    return { ...line, segments: line.segments.map((segment) => isParticle(segment, background)
      ? { ...segment, text: " ".repeat(segment.text.length) }
      : segment) };
  });
  return changed ? result : lines;
}
