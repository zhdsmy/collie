import { lineText, type Block, type StyledLine } from "../../blocks";
import { draftCarriesSend as textDraftCarriesSend } from "../../draft-match";
import type { HarnessAdapter } from "../types";
import { extractInputDraft, extractStatusLines, hasComposer, stripChrome } from "./chrome";

const COMPLETION_SUMMARY = /^─+\s+Worked for\b/;
const COMMAND_SUMMARY = /^•\s+Ran\s+\d+\s+commands\b/;
const DECORATIVE_RULE = /^─{40,}$/;
const RESIDUAL_RULE = /^─$/;
const UPLOAD_IMAGE_PATH =
  /(?:^|\s)(\/(?:[^\s/]+\/)*uploads\/[^\s/]+\.(?:gif|jpe?g|png|webp))(?=\s|$)/gi;
const IMAGE_PLACEHOLDER = /(?:^|\s)\[\s*Image\s+#\d+\s*\]/g;
const MIN_CAPTION_CHARS = 4;
const MIN_WINDOWED_CAPTION_CHARS = 8;

function isCompletionSummary(line: StyledLine): boolean {
  if (!COMPLETION_SUMMARY.test(lineText(line).trim())) return false;
  const visible = line.segments.filter((segment) => segment.text.trim().length > 0);
  return visible.length > 0 && visible.every((segment) => segment.dim === true);
}

function isCommandSummary(line: StyledLine): boolean {
  return COMMAND_SUMMARY.test(lineText(line).trim());
}

/**
 * Codex 0.149 emits its command-boundary rule as dim output. On narrow panes the
 * same rule can leave a final single-glyph row behind, so keep both shapes tied to
 * a preceding command summary instead of removing ordinary terminal rules.
 */
function isCommandBoundaryRule(line: StyledLine): boolean {
  const text = lineText(line).trim();
  if (!DECORATIVE_RULE.test(text) && !RESIDUAL_RULE.test(text)) return false;
  const visible = line.segments.filter((segment) => segment.text.trim().length > 0);
  return visible.length > 0 && visible.every((segment) => segment.dim === true);
}

function compactStatusSegment(text: string): string {
  return text
    // Keep one trailing space after separators so the display strip can wrap between items.
    .replace(/\s+·\s+/g, "· ")
    .replace(/\bContext\s+(\d+)(?:% left|…)/g, "Ctx $1%")
    .replace(/\bApprove(?: for)? me\b/g, "Approve")
    .replace(/\bFast (on|off)\b/g, "Fast:$1");
}

/** Compact only the Codex status strip; the captured line remains untouched for parsing. */
export function compactCodexStatusLines(lines: StyledLine[]): StyledLine[] {
  return lines.map((line) => ({
    ...line,
    segments: line.segments.map((segment) => ({
      ...segment,
      text: compactStatusSegment(segment.text),
    })),
  }));
}

function normalizeCompletionSummaries(lines: StyledLine[]): StyledLine[] {
  let normalized: StyledLine[] | undefined;
  let awaitingCommandBoundary = false;
  let skippingCommandBoundary = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;

    if (isCommandSummary(line)) {
      awaitingCommandBoundary = true;
      skippingCommandBoundary = false;
    } else if (
      (awaitingCommandBoundary || skippingCommandBoundary) &&
      isCommandBoundaryRule(line)
    ) {
      // Keep looking across blank rows: 0.149 can emit the long rule and its
      // one-glyph residue as separate rows.
      normalized ??= lines.slice(0, index);
      skippingCommandBoundary = true;
      continue;
    } else if (skippingCommandBoundary && lineText(line).trim().length > 0) {
      awaitingCommandBoundary = false;
      skippingCommandBoundary = false;
    }

    if (!isCompletionSummary(line)) {
      normalized?.push(line);
      continue;
    }

    normalized ??= lines.slice(0, index);
    normalized.push({ ...line, noWrap: true });
    while (
      index + 1 < lines.length &&
      DECORATIVE_RULE.test(lineText(lines[index + 1]!).trim())
    ) {
      index++;
    }
  }

  return normalized ?? lines;
}

function uploadPaths(text: string): string[] {
  return [...text.matchAll(UPLOAD_IMAGE_PATH)].map((match) => match[1]!);
}

function captionWithoutImages(text: string): string {
  return text.replace(UPLOAD_IMAGE_PATH, "").replace(IMAGE_PLACEHOLDER, "").trim();
}

function visibleCaptionLength(text: string): number {
  return Array.from(text).filter((character) => !/\s/u.test(character)).length;
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

  const sentCaption = captionWithoutImages(sent);
  const draftCaption = captionWithoutImages(draft);
  const exactCaption = draftCaption === sentCaption;
  const minimum = exactCaption ? MIN_CAPTION_CHARS : MIN_WINDOWED_CAPTION_CHARS;
  if (visibleCaptionLength(draftCaption) < minimum) return false;

  // Long Codex drafts are windowed, so leading paths and caption rows may be off-screen. The visible
  // caption must still satisfy the same fail-closed fold-seam matcher as ordinary text sends.
  return textDraftCarriesSend(sentCaption, draftCaption);
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  return [{ kind: "raw", lines: normalizeCompletionSummaries(stripChrome(lines)) }];
}

export { extractInputDraft, extractStatusLines };

export const codexAdapter: HarnessAdapter = {
  agent: "codex",
  buildBlocks: codexBuildBlocks,
  extractStatusLines,
  compactStatusLines: compactCodexStatusLines,
  extractInputDraft,
  // The reply path's pre-flight and post-type verifier now share the same captured Codex composer
  // shape. A modal without that tail refuses message bytes before they can land in the wrong UI.
  composerReady: hasComposer,
  // Codex consumes image paths and renders `[Image #N]`, so the generic literal verifier cannot
  // see the original send. Verify replacement tokens against this send's paths and caption.
  draftCarriesSend: imageDraftCarriesSend,
};
