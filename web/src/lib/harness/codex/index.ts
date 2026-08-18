import { lineText, type Block, type StyledLine } from "../../blocks";
import type { HarnessAdapter } from "../types";
import { extractInputDraft, extractStatusLines, stripChrome } from "./chrome";

const COMPLETION_SUMMARY = /^─+\s+Worked for\b/;
const DECORATIVE_RULE = /^─+$/;
const UPLOAD_IMAGE_PATH =
  /(?:^|\s)(\/(?:[^\s/]+\/)*uploads\/[^\s/]+\.(?:gif|jpe?g|png|webp))(?=\s|$)/gi;
const IMAGE_PLACEHOLDER = /\[\s*Image\s+#\d+\s*\]/g;
const MIN_CAPTION_CHARS = 4;
const MIN_WINDOWED_CAPTION_CHARS = 8;

function clipCompletionSummary(lines: StyledLine[]): StyledLine[] {
  let summaryIndex = lines.length - 1;
  while (summaryIndex >= 0 && DECORATIVE_RULE.test(lineText(lines[summaryIndex]!).trim())) {
    summaryIndex--;
  }

  const summary = lines[summaryIndex];
  if (summary === undefined || !COMPLETION_SUMMARY.test(lineText(summary).trim())) return lines;

  // Codex may paint the completion rule as separate terminal rows. They carry no information and
  // wrap again on a phone, so retain only the labelled row and keep that row from wrapping.
  return [...lines.slice(0, summaryIndex), { ...summary, noWrap: true }];
}

function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
}

function uploadPaths(text: string): string[] {
  return [...text.matchAll(UPLOAD_IMAGE_PATH)].map((match) => match[1]!);
}

/** Verify Codex's replacement of Collie upload paths with its own `[Image #N]` tokens. */
export function imageDraftCarriesSend(sent: string, draft: string): boolean {
  const sentPaths = uploadPaths(sent);
  if (sentPaths.length === 0) return false;

  const unmatchedPaths = [...sentPaths];
  for (const path of uploadPaths(draft)) {
    const index = unmatchedPaths.indexOf(path);
    if (index === -1) return false;
    unmatchedPaths.splice(index, 1);
  }

  const placeholderCount = [...draft.matchAll(IMAGE_PLACEHOLDER)].length;
  if (placeholderCount === 0 || placeholderCount > unmatchedPaths.length) return false;

  const sentCaption = compactWhitespace(sent.replace(UPLOAD_IMAGE_PATH, " "));
  const draftCaption = compactWhitespace(
    draft.replace(UPLOAD_IMAGE_PATH, " ").replace(IMAGE_PLACEHOLDER, " "),
  );
  const exactCaption = draftCaption === sentCaption;
  const minimum = exactCaption ? MIN_CAPTION_CHARS : MIN_WINDOWED_CAPTION_CHARS;
  if (Array.from(draftCaption).length < minimum) return false;

  // Long Codex drafts are windowed, so leading paths and caption rows may be off-screen. The visible
  // caption must still be one contiguous slice of the text sent alongside the images.
  return exactCaption || sentCaption.includes(draftCaption);
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  return [{ kind: "raw", lines: clipCompletionSummary(stripChrome(lines)) }];
}

export { extractInputDraft, extractStatusLines };

export const codexAdapter: HarnessAdapter = {
  agent: "codex",
  buildBlocks: codexBuildBlocks,
  extractStatusLines,
  extractInputDraft,
  // Codex consumes image paths and renders `[Image #N]`, so the generic literal verifier cannot
  // see the original send. Verify replacement tokens against this send's paths and caption.
  draftCarriesSend: imageDraftCarriesSend,
};
