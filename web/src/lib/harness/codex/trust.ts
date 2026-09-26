// Codex 0.156.1's folder-trust prompt. Only the current captured layout is lifted; unknown or
// older wording stays raw. The pointed choice is confirmed through an arrow walk and Enter.

import type { StyledLine } from "../../blocks";
import { pointerWalk } from "../menu-hints";
import type { PromptModel, PromptOption } from "../prompt-model";
import { lastNonBlankIndex, lineText, regionSignature, rstrip, skipBlanksUp } from "./markers";

export interface TrustRegion {
  model: PromptModel;
  startLine: number;
}

// Selected rows lead with `› `, unselected with two spaces; both carry `N. label`.
const OPTION = /^(?:› |\s{2})([12])\. (.+)$/;

// The 0.156.1 copy (codex--v0156-trust.txt): a `Folder access` heading and the folder, then
//
//   Trust this folder? Codex can read, edit, and run files here, subject to your permission …
// › 1. Trust and continue
//   2. Quit
//   enter continue · esc quit
//
// The rows are numbered, but the buttons send only the screen's Enter after walking the `›`
// pointer. The pointer is in the signature, so a stale tap is refused if it moves at the desk.
const NEW_FOOTER = /^\s*enter continue · esc quit$/;
const NEW_YES = /^Trust and continue$/;
const NEW_NO = /^Quit$/;
const NEW_QUESTION = /^\s*Trust this folder\?/;
// The paragraph under the question wraps with the pane; at 50 columns it runs to seven rows.
const NEW_QUESTION_REACH = 16;

export function detectTrustRegion(lines: StyledLine[]): TrustRegion | null {
  const texts = lines.map((l) => rstrip(lineText(l)));
  const fi = lastNonBlankIndex(texts);
  if (fi < 2 || !NEW_FOOTER.test(texts[fi]!)) return null;

  const bottom = skipBlanksUp(texts, fi - 1);
  if (bottom < 1) return null;
  const two = OPTION.exec(texts[bottom]!);
  const one = OPTION.exec(texts[bottom - 1]!);
  if (one === null || two === null) return null;
  if (one[1] !== "1" || two[1] !== "2") return null;
  if (!NEW_YES.test(one[2]!.trim()) || !NEW_NO.test(two[2]!.trim())) return null;
  // Exactly one row carries the pointer; it is where a bare Enter lands.
  const pointedOne = texts[bottom - 1]!.startsWith("› ");
  const pointedTwo = texts[bottom]!.startsWith("› ");
  if (pointedOne === pointedTwo) return null;
  const pointed = pointedOne ? 0 : 1;

  // The question opens the paragraph above the options, across one blank row.
  let questionRow = -1;
  const top = skipBlanksUp(texts, bottom - 2);
  for (let i = top; i >= 0 && top - i < NEW_QUESTION_REACH; i--) {
    if (NEW_QUESTION.test(texts[i]!)) {
      questionRow = i;
      break;
    }
    if (texts[i]!.trim() === "") break;
  }
  if (questionRow < 0) return null;

  const signature = regionSignature(lines, questionRow, fi + 1);
  if (signature === "") return null;

  const options: PromptOption[] = [
    { label: "Trust and continue", keys: pointerWalk(pointed, 0) },
    { label: "Quit", keys: pointerWalk(pointed, 1) },
  ];
  options[pointed] = { ...options[pointed]!, keyLabel: "›" };

  return {
    startLine: bottom - 1,
    model: {
      question: "Trust this folder?",
      options,
      family: "trust",
      coreSignature: texts[questionRow]!.trim(),
      signature,
    },
  };
}
