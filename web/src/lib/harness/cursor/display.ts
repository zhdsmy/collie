import { lineText, type StyledLine } from "../../blocks";

const DIFF_BACKGROUNDS = new Set(["rgb(64,38,38)", "rgb(43,63,43)"]);
// Cursor pads its blocks to the pane width but leaves the outer column or two bare, and it paints
// nothing else this wide, so the shape identifies a block even when a release or theme re-picks the
// colour — which is what 1.11 did, moving the query from rgb(47,47,64) to rgb(31,31,37).
const BARE_COLUMNS = 2;
const MIN_FILL = 8;

function hasBackground(line: StyledLine, backgrounds: ReadonlySet<string>): string | null {
  for (const segment of line.segments) {
    if (segment.bg !== undefined && backgrounds.has(segment.bg)) return segment.bg;
  }
  return null;
}

/** The one background painting this row end to end, whatever colour Cursor picked for it. */
export function fillBackground(line: StyledLine): string | null {
  const width = lineText(line).length;
  if (width < MIN_FILL) return null;
  const painted = new Map<string, number>();
  for (const segment of line.segments) {
    if (segment.bg === undefined) continue;
    painted.set(segment.bg, (painted.get(segment.bg) ?? 0) + segment.text.length);
  }
  for (const [background, length] of painted) {
    if (length >= width - BARE_COLUMNS) return background;
  }
  return null;
}

/** Promote Cursor's own painted diff and submitted-query rows to full-width mirror surfaces. */
export function decorateCursorDisplay(lines: StyledLine[]): StyledLine[] {
  let changed = false;
  const decorated = lines.map((line) => {
    const diff = hasBackground(line, DIFF_BACKGROUNDS);
    const user = diff === null ? fillBackground(line) : null;
    const surface = diff !== null
      ? { kind: "diff" as const, background: diff }
      : user !== null
        ? { kind: "user" as const, background: user }
        : line.surface;
    if (surface === line.surface) return line;
    changed = true;
    return { ...line, surface };
  });
  return changed ? decorated : lines;
}
