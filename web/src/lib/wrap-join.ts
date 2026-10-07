import { lineText, type StyledLine } from "./blocks";
import type { TranscriptEntry } from "./types";

// Rejoins the rows an agent's TUI hard-wrapped, using the agent's own session log as the proof.
//
// ── WHY THE SCREEN CANNOT ANSWER THIS ALONE ──────────────────────────────────
// Claude Code and Codex lay prose out to their pane's width themselves and write each wrap as a real
// newline, with a hanging indent on the next row. The grid carries no soft-wrap flag for those rows
// (Herdr's `recent_unwrapped` is byte-identical on a Claude pane, HERDR_API.md), so on a phone the
// mirror wraps every 140-column row a second time and the paragraph reads as a full row, a stub, and
// an indented continuation. Guessing from row length, indent or punctuation was tried and withdrawn:
// a list item, a code line and a wrapped sentence look alike from the grid.
//
// ── WHAT PROVES A WRAP ────────────────────────────────────────────────────────
// The journal holds the prose the TUI laid out. Fold both to letters and digits (markup, bullets,
// indents and newlines all drop out), take the folded text either side of a row break, and find that
// probe in the folded journal. The journal characters between the two halves say what the break was:
// a newline there means the author broke the line; none means the TUI did. Every occurrence must
// agree, and a probe the journal does not hold — tool output, a dialog, a reply still streaming — is
// left exactly as the terminal drew it.
//
// ── IT ONLY DECIDES ───────────────────────────────────────────────────────────
// The plan is applied at render time (components/ansi-output.tsx), after every grammar has run, and
// the hidden characters still occupy their offsets, so find, links and copy see the screen as read.

/** Folded characters taken either side of a break, and the least a whole probe may hold: one full
 *  side anchors it, so the other may be as short as a paragraph's last row ("rule."). */
const PROBE = 16;
/** Stands in a blank row in the folded screen. Never a word character, so a probe is cut there: a
 *  wrap never spans a blank row, and what lies past one (`✻ Cooked for 26m`) is not in the log. */
const PARAGRAPH = "\n";

/** Box drawing (U+2500–U+257F), block elements (U+2580–U+259F) and Claude's `⎿`: a row that opens
 *  or closes on one is a frame, gutter or tool result, never a wrapped sentence. */
const FRAME_CHAR = /[─-▟⎿]/;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** How a row is joined onto the row above it. */
export interface RowJoin {
  /** Leading spaces on this row that were the TUI's hanging indent. */
  readonly indent: number;
  /** Trailing whitespace on the row above, hidden along with the break. */
  readonly trail: number;
  /** The journal had whitespace at the break; without it the TUI split a word, and nothing goes between. */
  readonly space: boolean;
}

/** Row index → how it joins the row above. A row absent from the map keeps its newline. */
export type JoinPlan = ReadonlyMap<number, RowJoin>;

export const NO_JOINS: JoinPlan = new Map();

/** The journal folded once: the letters and digits, and where each one sat in the raw text. */
export interface FoldedSource {
  readonly raw: string;
  readonly folded: string;
  readonly at: readonly number[];
}

/** Everything the agent said, in order: the text the TUI laid out on screen. Tool calls are not prose,
 *  and a user turn is drawn from the composer, so both stay out. */
export function proseSource(entries: readonly TranscriptEntry[]): string {
  return entries
    .filter((entry) => entry.role === "assistant" && entry.abandoned !== true)
    .flatMap((entry) => entry.parts)
    .flatMap((part) => (part.kind === "text" || part.kind === "thinking" ? [part.text] : []))
    .join("\n\n");
}

export function foldSource(raw: string): FoldedSource {
  let folded = "";
  const at: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (!WORD_CHAR.test(ch)) continue;
    folded += ch;
    at.push(i);
  }
  return { raw, folded, at };
}

/** Unit by unit, exactly as {@link foldSource} walks, so both sides drop the same characters. */
function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) if (WORD_CHAR.test(text[i]!)) out += text[i]!;
  return out;
}

/** A row the join may touch: plain text, not a painted surface, a rule, or a clipped frame row. */
function plain(line: StyledLine): boolean {
  return !line.surface && !line.fullWidthRule && !line.fitRule && !line.noWrap;
}

/** What the journal says about the break at `boundary` in a probe that matched at `start`. */
function verdictAt(source: FoldedSource, start: number, boundary: number): "newline" | "space" | "none" {
  const between = source.raw.slice(source.at[start + boundary - 1]! + 1, source.at[start + boundary]!);
  if (between.includes("\n")) return "newline";
  return /\s/.test(between) ? "space" : "none";
}

/**
 * Which rows of one block join the row above them.
 *
 * `skip` names rows the caller renders some other way (a table run's scroller, an image cluster), so
 * the plan never reaches into them.
 */
export function planJoins(
  lines: readonly StyledLine[],
  source: FoldedSource,
  skip: (row: number) => boolean = () => false,
): JoinPlan {
  if (source.folded.length === 0 || lines.length < 2) return NO_JOINS;
  const texts = lines.map(lineText);
  // The block folded into one string, with where each row starts in it: a probe may run across
  // several short rows, which is how a stub like "xt." still gets context.
  const starts: number[] = [];
  let screen = "";
  for (const text of texts) {
    starts.push(screen.length);
    screen += text.trim() === "" ? PARAGRAPH : fold(text);
  }

  const plan = new Map<number, RowJoin>();
  for (let row = 1; row < lines.length; row++) {
    if (skip(row) || skip(row - 1) || !plain(lines[row]!) || !plain(lines[row - 1]!)) continue;
    const above = texts[row - 1]!;
    const here = texts[row]!;
    const aboveEnd = above.trimEnd();
    const hereBody = here.trimStart();
    if (aboveEnd === "" || hereBody === "") continue;
    // The hanging indent is spaces and nothing else; a gutter or a frame means another structure.
    const indent = here.length - hereBody.length;
    if (here.slice(0, indent).trim() !== "" || /\t/.test(here.slice(0, indent))) continue;
    if (FRAME_CHAR.test(aboveEnd.at(-1)!) || FRAME_CHAR.test(hereBody[0]!)) continue;

    const at = starts[row]!;
    const left = screen.slice(Math.max(0, at - PROBE), at).split(PARAGRAPH).at(-1)!;
    const right = screen.slice(at, at + PROBE).split(PARAGRAPH)[0]!;
    if (left === "" || right === "" || left.length + right.length < PROBE) continue;

    const probe = left + right;
    let verdict: "newline" | "space" | "none" | null = null;
    let agreed = true;
    for (let hit = source.folded.indexOf(probe); hit !== -1; hit = source.folded.indexOf(probe, hit + 1)) {
      const seen = verdictAt(source, hit, left.length);
      if (verdict !== null && seen !== verdict) {
        agreed = false;
        break;
      }
      verdict = seen;
    }
    if (!agreed || verdict === null || verdict === "newline") continue;
    plan.set(row, { indent, trail: above.length - aboveEnd.length, space: verdict === "space" });
  }
  return plan.size === 0 ? NO_JOINS : plan;
}
