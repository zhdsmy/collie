import { lineText, type StyledLine } from "../../blocks";

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
    const background = line.segments.find((segment) => segment.text.length > 0)?.bg;
    const user = submitted.has(line) || line.segments.some((segment) => segment.bg === CODEX_USER_MESSAGE_BG);
    const surface = user ? USER_SURFACE
      : background && DIFF_BACKGROUNDS.has(background) ? { kind: "diff" as const, background }
      : line.surface;

    if (surface === line.surface) return line;
    changedLines = true;
    return { ...line, surface };
  });

  return changedLines ? decorated : lines;
}
