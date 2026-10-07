// Codex keeps its native Warnings and other footer-named modals behind the unread-dialog card.
// Collie lifts resume/model/agent pickers, trust and approvals, and three dialogs as picker cards:
// `request_user_input` questions (pointer, question navigation, explicit confirmation and in-card
// notes, ASK_NOTES.md), the Plan prompt (PLAN_NOTES.md) and the `/review` pickers
// (REVIEW_NOTES.md). composerReady/composerPrompt guard ordinary chat submissions independently. A
// native modal whose footer names Esc as its way back and that no grammar lifts gets the
// unread-dialog card (.adr/0053), which is how Chat, where no mirror is drawn, shows it at all
// (MODAL_NOTES.md).

import { lineText, trimTrailingBlank, type Block, type StyledLine } from "../../blocks";
import type { HarnessAdapter } from "../types";
import {
  composerPrompt,
  composerReady,
  extractInputDraft,
  extractStatusLines,
  stripChrome,
} from "./chrome";
import { detectApprovalRegion } from "./approval";
import { detectAskRegion } from "./ask";
import { detectTrustRegion } from "./trust";
import { detectPickerRegion } from "./picker";
import { detectResumeRegion } from "./resume";
import { detectAgentsRegion } from "./agents";
import { detectPlanRegion } from "./plan";
import { detectReviewRegion } from "./review";
import { decorateCodexDisplay } from "./display";
import { codexDraftCarriesSend } from "./paste";
import { draftCarriesSend } from "../../draft-match";

function raw(lines: StyledLine[]): Block {
  return { kind: "raw", lines: decorateCodexDisplay(lines) };
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  const picker = detectPlanRegion(lines) ?? detectReviewRegion(lines) ?? detectResumeRegion(lines) ??
    detectAgentsRegion(lines) ?? detectPickerRegion(lines) ?? detectAskRegion(lines);
  if (picker) {
    const before = trimTrailingBlank(lines.slice(0, picker.startLine));
    return [
      ...(before.length > 0 ? [raw(before)] : []),
      { kind: "picker", picker: picker.model, lines: lines.slice(picker.startLine) },
    ];
  }
  const prompt = detectTrustRegion(lines) ?? detectApprovalRegion(lines);
  if (prompt) {
    const before = trimTrailingBlank(lines.slice(0, prompt.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push(raw(before));
    blocks.push({
      kind: "prompt-select",
      prompt: prompt.model,
      lines: lines.slice(prompt.startLine),
    });
    return blocks;
  }

  const content = stripChrome(lines);
  // The removed composer owns its leading spacer rows, not the transcript above it.
  return [raw(content === lines ? lines : trimTrailingBlank(content))];
}

export { extractStatusLines, extractInputDraft };

// How many of the screen's last non-blank rows may carry the footer (Claude's MODAL_HINT_ROWS).
const MODAL_HINT_ROWS = 6;
// Esc as a way BACK, in the words Codex 0.160.1 prints: `esc back` (Plan, /review), `esc dismiss &
// close` (Warnings), and the older `esc to go back` / `esc to cancel`. Each was pressed live
// (MODAL_NOTES.md). `esc quit` (trust), `esc skip` (hooks) and `tab or esc to clear notes` name
// something else and never match.
const ESC_WAY_BACK = /\besc(?: to)? (?:go back|back|cancel|close|dismiss)\b/i;
// A question's footer: Esc there interrupts the whole turn (ASK_NOTES.md), so it is never a way back.
const ESC_INTERRUPTS = /\besc to interrupt\b/i;

/** Whether a Codex modal is up whose own footer names Esc as the way back, and nothing on it says
 *  Esc interrupts the turn. */
function escGoesBack(lines: StyledLine[]): boolean {
  const rows: string[] = [];
  for (let i = lines.length - 1; i >= 0 && rows.length < MODAL_HINT_ROWS; i--) {
    const text = lineText(lines[i]!);
    if (text.trim() !== "") rows.push(text);
  }
  return rows.some((t) => ESC_WAY_BACK.test(t)) && !rows.some((t) => ESC_INTERRUPTS.test(t));
}

export const codexAdapter: HarnessAdapter = {
  agent: "codex",
  buildBlocks: codexBuildBlocks,
  extractStatusLines,
  extractInputDraft,
  composerReady,
  composerPrompt,
  // The way out of a native modal, offered only where the screen itself names Esc as one.
  cancelKey: "Escape",
  modalOnScreen: escGoesBack,
  draftCarriesSend: codexDraftCarriesSend,
  literalDraftCarriesSend: (sent, draft) => draftCarriesSend(sent, draft, { requireTail: true }),
};
