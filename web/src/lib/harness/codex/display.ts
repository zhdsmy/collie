import { lineText, type StyledLine } from "../../blocks";
import { PURE_HORIZONTAL_RULE_GLYPH_CLASS } from "../../rule-glyphs";

// A CODEX LABELLED SEPARATOR: a short rule, one label, then a rule that runs to the row's end, as
// in `─ Worked for 3m 12s ─────────────…`. blocks.ts already clips a BARE terminal-width rule
// (PURE_HORIZONTAL_BORDER) and a framed row (FRAME_ROW); this shape falls through both, because the
// label breaks the "one repeated glyph, nothing else" test and the row has no frame edges. Wrapped,
// it lands as a stub of rule glyphs on a second visual row under the label, several times a turn.
//
// The shape is the whole guard. Clipping hides a row's right edge, so the classifier must not fire
// on ordinary output Codex prints: a markdown table, a code block, a diff. Requiring the ENTIRE row
// to be rule / label / rule, with a label that carries no rule glyph of its own, means a row with a
// long rule run somewhere inside it is left to wrap as before.
//
// The two counts are this module's own, and cite no threshold elsewhere (see rule-glyphs.ts: share
// the alphabet, never a predicate or a threshold). The leading run is short by observation, because
// Codex paints one glyph, and four leaves room without admitting a rule that merely has text after
// it. The trailing run is floored at twenty because a shorter row already fits the narrowest
// mirror, so clipping it would buy nothing.
const MAX_LEADING_RULE_RUN = 4;
const MIN_TRAILING_RULE_RUN = 20;
const RULE = PURE_HORIZONTAL_RULE_GLYPH_CLASS;
const LABELLED_RULE_ROW = new RegExp(
  `^\\s*([${RULE}])\\1{0,${MAX_LEADING_RULE_RUN - 1}} +` + // a short leading rule
    `[^${RULE}\\s](?:[^${RULE}]*[^${RULE}\\s])? +` + // the label: no rule glyph, no edge space
    `([${RULE}])\\2{${MIN_TRAILING_RULE_RUN - 1},}\\s*$`, // a rule to the row's end
);

// Legacy Codex user fill, replaced only on the message surface.
export const CODEX_USER_MESSAGE_BG = "rgb(240,240,240)";
// Dark-space gray also becomes a gentle gray after the light mirror's inversion.
const USER_SURFACE = { kind: "user", background: "#1c1c1c" } as const;
const DIFF_BACKGROUNDS = new Set(["rgb(33,58,43)", "rgb(74,34,29)", "rgb(74,34,34)"]);

function submittedStart(line: StyledLine): boolean {
  if (!/^\u203a\s+\S/.test(lineText(line))) return false;
  const marker = line.segments.find((segment) => segment.text.includes("\u203a"));
  // The live composer uses a bold but non-dim marker. Only history echoes dim it.
  return Boolean((marker?.bold && marker.dim) || marker?.bg === CODEX_USER_MESSAGE_BG);
}

function submittedRows(lines: StyledLine[]): Set<StyledLine> {
  const rows = new Set<StyledLine>();
  for (let i = 0; i < lines.length; i++) {
    if (!submittedStart(lines[i]!)) continue;
    let end = i + 1;
    while (end < lines.length && /^(?: {2}|\s*$)/.test(lineText(lines[end]!))) {
      if (lines[end]!.segments.some((segment) => segment.bg && DIFF_BACKGROUNDS.has(segment.bg))) break;
      end++;
    }
    // Empty paragraphs belong to the message; its trailing separator does not.
    while (end > i + 1 && lineText(lines[end - 1]!).trim() === "") end--;
    for (; i < end; i++) rows.add(lines[i]!);
    i--;
  }
  return rows;
}

/** Mark full-row diff/user surfaces and clip labelled rules without changing visible text.
 * Unmatched screens retain their original array and line identities. */
export function decorateCodexDisplay(lines: StyledLine[]): StyledLine[] {
  const submitted = submittedRows(lines);
  let changedLines = false;
  const decorated = lines.map((line) => {
    const noWrap = line.noWrap || LABELLED_RULE_ROW.test(lineText(line));
    const background = line.segments.find((segment) => segment.text.length > 0)?.bg;
    const user = submitted.has(line) || line.segments.some((segment) => segment.bg === CODEX_USER_MESSAGE_BG);
    const surface = user ? USER_SURFACE
      : background && DIFF_BACKGROUNDS.has(background) ? { kind: "diff" as const, background }
      : line.surface;

    if (surface === line.surface && noWrap === Boolean(line.noWrap)) return line;
    changedLines = true;
    const next: StyledLine = { ...line, surface };
    if (noWrap) next.noWrap = true;
    return next;
  });

  return changedLines ? decorated : lines;
}
