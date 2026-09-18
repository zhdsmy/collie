import type { StyledLine } from "../../blocks";

const USER_BACKGROUND = "rgb(47,47,64)";
const DIFF_BACKGROUNDS = new Set(["rgb(64,38,38)", "rgb(43,63,43)"]);

function hasBackground(line: StyledLine, backgrounds: ReadonlySet<string>): string | null {
  for (const segment of line.segments) {
    if (segment.bg !== undefined && backgrounds.has(segment.bg)) return segment.bg;
  }
  return null;
}

/** Promote Cursor's own painted diff and submitted-query rows to full-width mirror surfaces. */
export function decorateCursorDisplay(lines: StyledLine[]): StyledLine[] {
  let changed = false;
  const decorated = lines.map((line) => {
    const user = line.segments.some((segment) => segment.bg === USER_BACKGROUND);
    const diff = hasBackground(line, DIFF_BACKGROUNDS);
    const surface = user
      ? { kind: "user" as const, background: USER_BACKGROUND }
      : diff !== null
        ? { kind: "diff" as const, background: diff }
        : line.surface;
    if (surface === line.surface) return line;
    changed = true;
    return { ...line, surface };
  });
  return changed ? decorated : lines;
}
