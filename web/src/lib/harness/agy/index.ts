import { trimTrailingBlank, type Block, type StyledLine } from "../../blocks";
import type { DialogDetector, HarnessAdapter } from "../types";
import { detectArtifactRegion } from "./artifact";
import { extractInputDraft, extractStatusLines, hasInputBox, normalizeAgyScreenRows, stripChrome } from "./chrome";
import { detectConversationsRegion } from "./conversations";
import { classifyFooter, lineText } from "./markers";
import { detectAgyModalRegion } from "./modals";
import { detectModelRegion } from "./model";
import { detectPromptSelectRegion } from "./prompt-select";

/** The conversations picker, read off the rows' text. */
function conversationsRegion(lines: StyledLine[]) {
  return detectConversationsRegion(lines.map((l) => lineText(l).trimEnd()));
}

/** The detectors `agyBuildBlocks` runs, in its order, for the unread-dialog card's report (ADR 0123). */
const AGY_DIALOG_DETECTORS: readonly DialogDetector[] = [
  { name: "prompt-select", detect: detectPromptSelectRegion },
  { name: "model", detect: detectModelRegion },
  { name: "conversations", detect: conversationsRegion },
  { name: "artifact", detect: detectArtifactRegion },
  { name: "modal", detect: detectAgyModalRegion },
];

export function agyBuildBlocks(lines: StyledLine[]): Block[] {
  const region = detectPromptSelectRegion(lines);
  if (region) {
    const before = trimTrailingBlank(lines.slice(0, region.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push({ kind: "raw", lines: before });
    blocks.push({ kind: "prompt-select", prompt: region.model, lines: lines.slice(region.startLine, region.statusStartLine) });
    return blocks;
  }

  const picker =
    detectModelRegion(lines) ??
    conversationsRegion(lines) ??
    detectArtifactRegion(lines) ??
    detectAgyModalRegion(lines);
  if (picker) {
    const before = trimTrailingBlank(lines.slice(0, picker.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push({ kind: "raw", lines: before });
    blocks.push({ kind: "menu", menu: picker.model, lines: lines.slice(picker.startLine, picker.statusStartLine) });
    return blocks;
  }

  return [{ kind: "raw", lines: stripChrome(lines) }];
}

export { extractStatusLines, extractInputDraft, normalizeAgyScreenRows };

const MODAL_HINT_ROWS = 6;
const AGY_MODAL_CUE =
  /^\s*Keyboard:\s|\besc(?:ape)?(?:\s+to)?\s+(?:cancel|close|exit|dismiss|skip|go back|clear)\b|^└ (?:Models & Quota|Context Usage)\s*$|^\s*[❯›>]\s*\d+\.\s+\S/i;

/** Whether the screen's last non-blank rows show an AGY modal rather than a startup/signing-in or shell screen. */
function agyModalOnScreen(lines: StyledLine[]): boolean {
  const rows: string[] = [];
  for (let i = lines.length - 1; i >= 0 && rows.length < MODAL_HINT_ROWS; i--) {
    const text = lineText(lines[i]!);
    if (text.trim() !== "") rows.push(text);
  }
  return rows.some((t) => classifyFooter(t) !== null || AGY_MODAL_CUE.test(t));
}

export const agyAdapter: HarnessAdapter = {
  agent: "agy",
  normalizeScreenRows: normalizeAgyScreenRows,
  buildBlocks: agyBuildBlocks,
  extractStatusLines,
  extractInputDraft,
  composerReady: hasInputBox,
  // The way OUT of an AGY modal, for the unread-dialog card (.adr/0053). Its captures print the
  // Claude-style footer: `fixtures/panes/agy--permission-bash.txt`, `agy--permission-edit.txt`,
  // `agy--plan-approval.txt` and `agy--select-menu.txt` all print `esc to cancel`.
  cancelKey: "Escape",
  modalOnScreen: agyModalOnScreen,
  dialogDetectors: AGY_DIALOG_DETECTORS,
};

export const antigravityAdapter: HarnessAdapter = {
  agent: "antigravity",
  normalizeScreenRows: normalizeAgyScreenRows,
  buildBlocks: agyBuildBlocks,
  extractStatusLines,
  extractInputDraft,
  composerReady: hasInputBox,
  // Same harness, same registration, same declaration — see `agyAdapter` above.
  cancelKey: "Escape",
  modalOnScreen: agyModalOnScreen,
  dialogDetectors: AGY_DIALOG_DETECTORS,
};
