import { lineText, type StyledLine } from "../../blocks";

function withoutPadding(line: StyledLine): StyledLine {
  const last = line.segments.at(-1);
  if (!last || !/^ +$/.test(last.text) || last.fg || last.dim || last.bold ||
      last.italic || last.underline || last.strike || last.bg !== line.surface?.background) return line;
  return { ...line, segments: line.segments.slice(0, -1) };
}

function continuationGutter(line: StyledLine, width: number, margin: number): boolean {
  if (!lineText(line).startsWith(" ".repeat(width))) return false;
  let offset = 0;
  for (const segment of line.segments) {
    const end = offset + segment.text.length;
    // Codex leaves a plain left margin, then dims the blank line-number/sign gutter.
    if (end > margin && offset < width && (!segment.dim || segment.fg)) return false;
    offset = end;
    if (offset >= width) return true;
  }
  return false;
}

/** Undo Codex's diff grid wraps only on display copies. A dim blank gutter continues the
 * preceding numbered source line; concatenate literally so code, spaces and URLs survive. */
export function reflowCodexDiffs(lines: StyledLine[]): StyledLine[] {
  const result: StyledLine[] = [];
  let gutter = 0;
  let margin = 0;
  let changed = false;
  for (const line of lines) {
    const previous = result.at(-1);
    if (line.noWrap || line.surface?.kind !== "diff") {
      gutter = 0;
      result.push(line);
      continue;
    }
    if (gutter && previous?.surface?.background === line.surface.background && continuationGutter(line, gutter, margin)) {
      let remaining = gutter;
      const segments = [...previous.segments];
      for (const segment of withoutPadding(line).segments) {
        const drop = Math.min(remaining, segment.text.length);
        remaining -= drop;
        const text = segment.text.slice(drop);
        if (text) segments.push(drop ? { ...segment, text } : segment);
      }
      result[result.length - 1] = { ...previous, segments };
      changed = true;
    } else {
      const numbered = /^( +)\d+ [+-]/.exec(lineText(line));
      const trimmed = numbered ? withoutPadding(line) : line;
      gutter = numbered && lineText(trimmed).slice(numbered[0].length).trim() ? numbered[0].length : 0;
      margin = numbered ? numbered[1]!.length : 0;
      changed ||= trimmed !== line;
      result.push(trimmed);
    }
  }
  return changed ? result : lines;
}
