import { lineText, type Block, type StyledLine } from "../../blocks";
import type { HarnessAdapter } from "../types";
import { extractInputDraft, extractStatusLines, stripChrome } from "./chrome";

const EXIT_SUMMARY_RULE = /^─+\s+Worked for\b.*─{20,}$/;

function clipExitSummaryRule(lines: StyledLine[]): StyledLine[] {
  const last = lines.at(-1);
  if (last === undefined || last.noWrap || !EXIT_SUMMARY_RULE.test(lineText(last).trim())) {
    return lines;
  }

  // Codex labels a terminal-width rule with the elapsed time. Wrapping its filler turns one summary
  // into several rows on a phone; clipping only the right-hand decoration keeps the label intact.
  return [...lines.slice(0, -1), { ...last, noWrap: true }];
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  return [{ kind: "raw", lines: clipExitSummaryRule(stripChrome(lines)) }];
}

export { extractInputDraft, extractStatusLines };

export const codexAdapter: HarnessAdapter = {
  agent: "codex",
  buildBlocks: codexBuildBlocks,
  extractStatusLines,
  extractInputDraft,
};
