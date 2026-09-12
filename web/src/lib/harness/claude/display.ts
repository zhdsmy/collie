import { lineText, type StyledLine } from "../../blocks";

// Claude's changed rows have a painted line-number/sign gutter after unpainted indentation.
// Promote that existing fill to the shared full-row surface; keep syntax and token highlights.
// This runs only on transcript blocks, after interactive dialogs have been recognized.
export function decorateClaudeDiff(lines: StyledLine[]): StyledLine[] {
  let changed = false;
  const decorated = lines.map((line) => {
    const prefix = /^(\s*)\d+\s+[+-](?:\s|$)/u.exec(lineText(line));
    if (!prefix) return line;
    const start = prefix[1]!.length;
    let offset = 0;
    let background: string | undefined;
    for (const segment of line.segments) {
      const end = offset + segment.text.length;
      if (end > start && offset < prefix[0].length) {
        if (!segment.bg || (background && segment.bg !== background)) return line;
        background = segment.bg;
      }
      offset = end;
      if (offset >= prefix[0].length) break;
    }
    if (!background) return line;
    // A colored number/sign alone can be a log label. Diff text keeps its base fill or a
    // stronger word highlight; only the outside whitespace may be unpainted.
    if (line.segments.some((s) => s.text.trim() && !s.bg)) return line;
    changed = true;
    return { ...line, surface: { kind: "diff" as const, background } };
  });
  return changed ? decorated : lines;
}
