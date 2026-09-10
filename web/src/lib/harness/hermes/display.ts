import { lineText, type StyledLine } from "../../blocks";

// Hermes' inline unified diff uses white ink on a skin-derived red/green tint. Herdr may
// quantize the RGB fill to xterm-256 (135,0,0 / 0,95,0 in the 2026-09-10 capture).
// Match a painted change row inside a hunk, never an arbitrary colored log or status field.
const HUNK = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/u;
const DIFF_FILL = { "+": "rgb(33,58,43)", "-": "rgb(74,34,29)" } as const;

export function decorateHermesDiff(lines: StyledLine[]): StyledLine[] {
  let inHunk = false;
  return lines.map((line) => {
    const text = lineText(line);
    if (HUNK.test(text)) {
      inHunk = true;
      return line;
    }
    const sign = text[0];
    if (!inHunk) return line;
    if (sign !== "+" && sign !== "-") {
      if (!text.startsWith(" ") && text !== "\\ No newline at end of file") inHunk = false;
      return line;
    }
    const painted = line.segments.filter((s) => s.text.length > 0);
    const background = painted[0]?.bg;
    if (!background || painted.some((s) => s.bg !== background || s.fg !== "rgb(255,255,255)")) {
      inHunk = false;
      return line;
    }
    const fill = DIFF_FILL[sign];
    return { ...line, surface: { kind: "diff", background: fill }, segments: line.segments.map((s) => ({
      ...s, bg: fill, style: { ...s.style, backgroundColor: fill },
    })) };
  });
}
