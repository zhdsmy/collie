// The Claude Code STATUSLINE's MODE field — the one control on that row a phone can drive.
//
// Claude paints its permission mode under the input box and says how to change it in the same breath:
//
//     ⏵⏵ bypass permissions on (shift+tab to cycle) · ← 1 agent     (claude--draft-footer-single.txt)
//     ⏸ manual mode on                                              (claude--draft-wrapped.txt)
//     ⏸ manual mode on · ← 4 agents                                 (claude--menu-model-picker-dismissed)
//     ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt · …    (a live pane, 2026-09-14)
//
// So the mode is `<⏵⏵|⏸> <name> on`, the cycle key is the terminal's own `shift+tab`, and the
// `(shift+tab to cycle)` parenthetical is a HINT rather than part of the mode: this module splits it
// off so the renderer can draw an icon in its place (components/statusline-row.tsx), and so two reads
// of the same mode compare equal whether or not the hint was painted.
//
// WHAT IS NOT VERIFIED. We do not know the cycle ORDER, and we do not claim to: the app sends the key
// and then reads back whether the mode TEXT changed. `shift+tab` while a dialog is open is likewise
// unprobed — and provably dangerous, since the permission dialog's own answer row reads
// `2. Yes, allow all edits during this session (shift+tab)`, so sending it there would answer the
// dialog on the operator's behalf. That is why a keyboard-owning block refuses this control outright,
// exactly as it refuses every other adapter-driven write (harness/dialog-contract.ts).

import { parseAnsi } from "../../ansi";
import { lineText, splitLines, type StyledLine } from "../../blocks";
import { blockOwnsKeyboard } from "../dialog-contract";
import { claudeBuildBlocks } from ".";
import { composerRegion, extractStatusLines } from "./chrome";

/** The parenthetical Claude prints after a mode it will cycle, and never part of the mode itself. */
const CYCLE_HINT = " (shift+tab to cycle)";

/** `⏵⏵ bypass permissions on`, `⏸ manual mode on` — a glyph, a name, and `on`. */
const MODE = /^(?:⏵⏵|⏸)\s+\S.*\bon$/u;

/** Claude separates statusline fields with a middle dot, padded on both sides. */
const FIELD = /( · )/;

export interface ClaudeModeField {
  /** The statusline's own indent, kept so the row still starts where it started. */
  indent: StyledLine;
  /** The mode text alone, styled as the terminal painted it (the hint is gone). */
  mode: StyledLine;
  /** Everything after the mode — the rest of the row, minus the hint we are replacing with an icon. */
  rest: StyledLine;
  /** Whether the row carried the `(shift+tab to cycle)` hint — the terminal's own affordance. */
  hasHint: boolean;
}

/** The mode field of a statusline ROW, or null when this row is not the mode row. */
export function modeFieldOf(row: StyledLine): ClaudeModeField | null {
  const text = lineText(row);
  const first = text.split(FIELD)[0] ?? "";
  // The field keeps the statusline's own indent, which the mode measurement must not: `⏵⏵` is the
  // row's first glyph, so a pattern anchored at the string start is testing the paste, not the mode.
  const body = first.trim();
  const hasHint = body.endsWith(CYCLE_HINT);
  const mode = hasHint ? body.slice(0, -CYCLE_HINT.length) : body;
  if (!MODE.test(mode)) return null;
  const start = text.length - text.trimStart().length;
  const modeEnd = start + mode.length;
  const hintEnd = hasHint ? modeEnd + CYCLE_HINT.length : modeEnd;
  return {
    indent: { ...row, segments: sliceSegments(row.segments, 0, start) },
    mode: { ...row, segments: sliceSegments(row.segments, start, modeEnd) },
    rest: { ...row, segments: sliceSegments(row.segments, hintEnd, text.length) },
    hasHint,
  };
}

/** The row's characters `[start, end)`, with each segment's own paint carried across the cut. */
function sliceSegments(segments: StyledLine["segments"], start: number, end: number): StyledLine["segments"] {
  let offset = 0;
  const out: StyledLine["segments"] = [];
  for (const segment of segments) {
    const from = Math.max(0, start - offset);
    const to = Math.min(segment.text.length, end - offset);
    offset += segment.text.length;
    if (from < to) out.push({ ...segment, text: segment.text.slice(from, to) });
  }
  return out;
}

export interface ClaudeModeState {
  /** The mode as read, hint stripped — the same string two reads must differ on to count as switched. */
  mode: string;
  hasHint: boolean;
  /** The bound region a write rides on, from the same read that established the mode. */
  prompt: string;
}

/**
 * The pane's current mode, or null when this pane is not showing one — no input box at the tail, no
 * mode row in the statusline run, or a block that owns the keyboard (see the header).
 */
export function readClaudeModeState(text: string): ClaudeModeState | null {
  const lines = splitLines(parseAnsi(text));
  if (claudeBuildBlocks(lines).some(blockOwnsKeyboard)) return null;
  const row = extractStatusLines(lines).find((candidate) => modeFieldOf(candidate) !== null);
  if (row === undefined) return null;
  const field = modeFieldOf(row);
  if (field === null) return null;
  const prompt = composerRegion(lines);
  if (prompt === null) return null;
  return { mode: lineText(field.mode).trim(), hasHint: field.hasHint, prompt };
}
