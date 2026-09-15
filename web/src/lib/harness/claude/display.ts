import { lineText, type StyledLine } from "../../blocks";

// Codex's uniform user-echo fill (harness/codex/display.ts) — one dark-space grey that the light
// mirror's inversion turns into the same gentle grey, so both harnesses' histories read alike.
const USER_SURFACE = { kind: "user", background: "#1c1c1c" } as const;

/**
 * The submitted-input echo, promoted to the shared full-row surface.
 *
 * Claude paints a sent message as `❯ <text>` with the marker and text on the message fill, wraps
 * included, and pads every row of the message with that fill — so the rectangle is there in the
 * ANSI but ragged: each row ends where its own padding ran out, and the segment greys differ from
 * row to row. Marking the rows `user` lets the renderer draw ONE rectangle across the full row
 * width and drop the per-segment fills (ansi-output's `surfaceSegmentStyle`), which is what the
 * phone should read as "this is what was sent".
 *
 * Detection is structural, in the same spirit as the diff gutter above: a row that LEADS with a
 * painted `❯` starts a message — the live composer's prompt is unpainted and stripped before this
 * runs, and no transcript row that is not an echo carries a backgrounded `❯` — and the message
 * continues across rows that still carry the same fill, blank rows included (Claude pads an empty
 * paragraph with it). The first row without the fill ends the message.
 */
export function decorateClaudeUser(lines: StyledLine[]): StyledLine[] {
  const starts: number[] = [];
  lines.forEach((line, index) => {
    if (!lineText(line).startsWith("❯")) return;
    const marker = line.segments.find((segment) => segment.text.includes("❯"));
    if (marker?.bg) starts.push(index);
  });
  if (starts.length === 0) return lines;

  const submitted = new Set<number>();
  for (const start of starts) {
    const fill = lines[start]!.segments.find((segment) => segment.text.includes("❯"))!.bg!;
    let end = start + 1;
    while (end < lines.length && lines[end]!.segments.some((segment) => segment.bg === fill)) end++;
    for (let i = start; i < end; i++) submitted.add(i);
  }

  let changed = false;
  const decorated = lines.map((line, index) => {
    if (!submitted.has(index)) return line;
    changed = true;
    return { ...line, surface: USER_SURFACE };
  });
  return changed ? decorated : lines;
}

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
