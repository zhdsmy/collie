// Codex keeps its native QA, plan, review, and folder-trust screens.
// The upstream raw/chrome path handles those; only model/statusline/resume pickers
// and command approvals are lifted. Keep composerReady/composerPrompt independent
// of card rendering so native dialogs still reject ordinary chat submissions.

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
import { detectPickerRegion } from "./picker";
import { detectResumeRegion } from "./resume";
import { decorateCodexDisplay } from "./display";
import { codexDraftCarriesSend } from "./paste";
import { draftCarriesSend } from "../../draft-match";

function raw(lines: StyledLine[]): Block {
  return { kind: "raw", lines: decorateCodexDisplay(lines) };
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  const picker = detectResumeRegion(lines) ?? detectPickerRegion(lines);
  if (picker) {
    const before = trimTrailingBlank(lines.slice(0, picker.startLine));
    return [
      ...(before.length > 0 ? [raw(before)] : []),
      { kind: "picker", picker: picker.model, lines: lines.slice(picker.startLine) },
    ];
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
