// The Codex adapter. Chrome/status/draft are Tier 1: the boxless `› ` composer plus its
// dot-separated status row are stripped from the mirror and re-surfaced natively. Interactive
// kinds with dated captures and notes (all under this directory): the folder-trust prompt
// (`prompt-select`, family trust), exec approvals (`prompt-select`, family permission —
// classified by row: the one-shot Yes and the reject become buttons, persistent rows never do),
// and `request_user_input` question cards (`picker` — pointer selection, question navigation and
// an explicit confirmation). Digits confirm directly on all three (probed;
// notes files). The notes flow of a question card stays in the terminal: the focused-notes
// state refuses to raw, because a digit would type into the box.
//
// The review bar is #99 (agy): exact agent string only, and every emitted keystroke probed on
// the captured screen. Registered as `agent: "codex"`; variant folding belongs in
// `canonicalAgent`, never here.

import { trimTrailingBlank, type Block, type StyledLine } from "../../blocks";
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
import { decorateCodexDisplay } from "./display";
import { codexDraftCarriesSend } from "./paste";
import { draftCarriesSend } from "../../draft-match";

function raw(lines: StyledLine[]): Block {
  return { kind: "raw", lines: decorateCodexDisplay(lines) };
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  const picker = detectPickerRegion(lines);
  if (picker) {
    const before = trimTrailingBlank(lines.slice(0, picker.startLine));
    return [
      ...(before.length > 0 ? [raw(before)] : []),
      { kind: "picker", picker: picker.model, lines: lines.slice(picker.startLine) },
    ];
  }
  const trust = detectTrustRegion(lines);
  if (trust) {
    const before = trimTrailingBlank(lines.slice(0, trust.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push(raw(before));
    blocks.push({ kind: "prompt-select", prompt: trust.model, lines: lines.slice(trust.startLine) });
    return blocks;
  }

  const approval = detectApprovalRegion(lines);
  if (approval) {
    const before = trimTrailingBlank(lines.slice(0, approval.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push(raw(before));
    blocks.push({
      kind: "prompt-select",
      prompt: approval.model,
      lines: lines.slice(approval.startLine),
    });
    return blocks;
  }

  const ask = detectAskRegion(lines);
  if (ask) {
    const before = trimTrailingBlank(lines.slice(0, ask.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push(raw(before));
    blocks.push({ kind: "picker", picker: ask.model, lines: lines.slice(ask.startLine) });
    return blocks;
  }

  const content = stripChrome(lines);
  // The removed composer owns its leading spacer rows, not the transcript above it.
  return [raw(content === lines ? lines : trimTrailingBlank(content))];
}

export { extractStatusLines, extractInputDraft };

export const codexAdapter: HarnessAdapter = {
  agent: "codex",
  buildBlocks: codexBuildBlocks,
  extractStatusLines,
  extractInputDraft,
  composerReady,
  composerPrompt,
  draftCarriesSend: codexDraftCarriesSend,
  literalDraftCarriesSend: (sent, draft) => draftCarriesSend(sent, draft, { requireTail: true }),
};
