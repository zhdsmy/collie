// Codex 0.149's list picker (live-probed with `/model`) is not the generic key-hint menu Claude
// paints. It has a bold Select/Choose title, numbered rows, and one exact footer that names Enter
// and Esc. Up/Down only moves the selection; Enter is the sole commit. Keep this detector tied to
// that whole framework so ordinary numbered output never gains live keys.

import type { StyledLine } from "../../blocks";
import type { MenuModel } from "../menu-model";
import { isBlank, lastNonBlankIndex, lineText, regionSignature, rstrip } from "./markers";

export interface CodexMenuRegion {
  model: MenuModel;
  startLine: number;
}

const FOOTER = /^Press enter to confirm or esc to go back$/i;
const OPTION = /^\s*(?:›\s*)?\d+\.\s+\S/;
const TITLE = /^(?:Select|Choose|Permissions)\b/i;
const REGION_SCAN_WINDOW = 40;
const TITLE_SCAN_WINDOW = 8;

/** Detect Codex's built-in selector at the pane tail. Pure; the caller owns pane access. */
export function detectCodexMenuRegion(lines: StyledLine[]): CodexMenuRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const footer = lastNonBlankIndex(texts);
  if (footer < 0 || !FOOTER.test(texts[footer]!.trim())) return null;

  const from = Math.max(0, footer - REGION_SCAN_WINDOW);
  const optionRows: number[] = [];
  for (let i = from; i < footer; i++) {
    if (OPTION.test(texts[i]!)) optionRows.push(i);
  }
  if (optionRows.length < 2) return null;

  const firstOption = optionRows[0]!;
  let title = -1;
  for (let i = firstOption - 1, seen = 0; i >= from && seen < TITLE_SCAN_WINDOW; i--, seen++) {
    if (isBlank(texts[i]!)) continue;
    if (
      TITLE.test(texts[i]!.trim()) &&
      lines[i]!.segments.some((segment) => segment.bold === true)
    ) {
      title = i;
      break;
    }
  }
  if (title < 0) return null;

  return {
    model: {
      title: texts[title]!.trim(),
      actions: [
        { label: "Confirm", keys: ["Enter"] },
        { label: "Go back", keys: ["Escape"], cancel: true },
      ],
      nav: { upDown: true },
      signature: regionSignature(lines, title, footer),
    },
    startLine: title,
  };
}

export function detectCodexMenu(lines: StyledLine[]): MenuModel | null {
  return detectCodexMenuRegion(lines)?.model ?? null;
}
