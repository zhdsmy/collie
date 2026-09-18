import { lineText, type StyledLine } from "../../blocks";

// Hermes' inline unified diff uses white ink on a skin-derived red/green tint. Herdr may
// quantize the RGB fill to xterm-256 (135,0,0 / 0,95,0 in the 2026-09-10 capture).
// Match a painted change row inside a hunk, never an arbitrary colored log or status field.
const HUNK = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/u;
const DIFF_FILL = { "+": "rgb(33,58,43)", "-": "rgb(74,34,29)" } as const;

export function decorateHermesDiff(lines: StyledLine[]): StyledLine[] {
  let inHunk = false;
  // The hunk's own paint, learned as rows arrive: the RAW fill a changed row wears (before the muted
  // rewrite below) and the ink a context row wears. The pane re-wraps a long diff line into
  // column-0 continuations that carry neither the +/- gutter nor, on context rows, their leading
  // space — but they still wear the paint, and a continuation that ends the hunk strands the rest of
  // it as ragged raw fill (measured on a resumed SKILL.md diff, 2026-09-19). So a row wearing either
  // is a continuation, not the end: fill-carrying ones are diff content and get the full-row surface
  // too; ink-carrying ones are context and stay undecorated. Anything wearing neither (the reply
  // frame, prose) ends the hunk, as does an empty row.
  let fills = new Map<string, string>();
  let contextFg: string | undefined;
  return lines.map((line) => {
    const text = lineText(line);
    if (HUNK.test(text)) {
      inHunk = true;
      fills = new Map();
      contextFg = undefined;
      return line;
    }
    const sign = text[0];
    if (!inHunk) return line;
    if (sign !== "+" && sign !== "-") {
      const painted = line.segments.find((s) => s.text.trim());
      if (painted !== undefined) {
        if (painted.bg !== undefined && fills.has(painted.bg)) {
          const fill = fills.get(painted.bg)!;
          return { ...line, surface: { kind: "diff", background: fill }, segments: line.segments.map((s) => ({
            ...s, bg: fill, style: { ...s.style, backgroundColor: fill },
          })) };
        }
        if (contextFg !== undefined && painted.fg === contextFg) return line;
      }
      if (!text.startsWith(" ") && text !== "\\ No newline at end of file") inHunk = false;
      else if (painted !== undefined) contextFg = painted.fg;
      return line;
    }
    const painted = line.segments.filter((s) => s.text.length > 0);
    const background = painted[0]?.bg;
    if (!background || painted.some((s) => s.bg !== background || s.fg !== "rgb(255,255,255)")) {
      inHunk = false;
      return line;
    }
    const fill = DIFF_FILL[sign];
    fills.set(background, fill);
    return { ...line, surface: { kind: "diff", background: fill }, segments: line.segments.map((s) => ({
      ...s, bg: fill, style: { ...s.style, backgroundColor: fill },
    })) };
  });
}
