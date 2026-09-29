import { lineText, type StyledLine } from "../../blocks";
import { namesAMenuKey } from "../menu-hints";
import { isModalEdge, MODAL_EDGE_WINDOW } from "./region-top";

/** The active Settings modal's boundary and highlighted tab, without parsing its body or actions. */
export function detectSettingsRegion(lines: StyledLine[]): { startLine: number; title: string } | null {
  const texts = lines.map(lineText);
  let end = texts.length - 1;
  while (end >= 0 && texts[end]!.trim() === "") end--;
  if (end < 0) return null;
  const tail = texts[end]!.trim();
  if (!(namesAMenuKey(tail) || tail === "↓ stats" || tail.includes("Loading your Claude Code stats"))) return null;
  for (let i = end; i >= 0 && end - i < MODAL_EDGE_WINDOW; i--) {
    if (!/^\s*Settings\s+Status\s+Config\s+Usage\s+Stats\s*$/.test(texts[i]!)) continue;
    const title = lines[i]!.segments.find((s) => s.bg !== undefined &&
      /^(Status|Config|Usage|Stats)$/.test(s.text.trim()))?.text.trim();
    if (title === undefined) return null;
    let edge = i - 1;
    while (edge >= 0 && texts[edge]!.trim() === "") edge--;
    if (edge < 0 || !isModalEdge(texts, edge, end)) return null;
    for (let j = i + 1; j <= end; j++) {
      if (isModalEdge(texts, j, end)) return null;
    }
    return { startLine: edge, title };
  }
  return null;
}
