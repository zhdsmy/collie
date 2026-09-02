// The Codex adapter. Chrome/status/draft are Tier 1: the boxless `› ` composer plus its
// dot-separated status row are stripped from the mirror and re-surfaced natively. Interactive
// kinds with dated captures and notes (all under this directory): the folder-trust prompt
// (`prompt-select`, family trust), exec approvals (`prompt-select`, family permission —
// classified by row: the one-shot Yes and the reject become buttons, persistent rows never do),
// and `request_user_input` question cards (`prompt-select`, family select — a digit answers the
// current question and submits on the last). Digits confirm directly on all three (probed;
// notes files). The notes flow of a question card stays in the terminal: the focused-notes
// state refuses to raw, because a digit would type into the box.
//
// The review bar is #99 (agy): exact agent string only, and every emitted keystroke probed on
// the captured screen. Registered as `agent: "codex"`; variant folding belongs in
// `canonicalAgent`, never here.

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
import { codexDraftCarriesSend } from "./paste";

const CONVERSATION_RECAP = /^[-\u2500]+\s+Conversation recap(?:\s+[-\u2500]+)?$/;
const COMPLETION_SUMMARY = /^[-\u2500]+\s+Worked for\b/;
const COMMAND_SUMMARY = /^•\s+Ran\s+\d+\s+commands\b/;
const COMMAND_EVENT =
  /^•\s+(?:Called|Edited|Explored|Ran|Read|Running|Searched|Viewed|Working|You have)(?:\s|$)/;
const ANSWER_LEAD = /^(?:•| {2}-)\s+\S/;
const PLAIN_ANSWER_ROW = /^ {2}\S/;
const SUBMITTED_QUERY_LEAD = /^›(?:\s|$)/;
const NESTED_ANSWER_CONTENT = /^(?:(?:[-+*•]|\d+[.)])(?:\s|$)|[│└┌┐┘┬├┤┼])/;
const STRUCTURAL_ANSWER_CONTENT = /^(?:```|~~~|[|─━═])/;
const DECORATIVE_RULE = /^[-\u2500]{40,}$/;

function isCompletionSummary(line: StyledLine): boolean {
  if (!COMPLETION_SUMMARY.test(lineText(line).trim())) return false;
  const visible = line.segments.filter((segment) => segment.text.trim().length > 0);
  return visible.length > 0 && visible.every((segment) => segment.dim === true);
}

function isSubmittedQueryLead(line: StyledLine): boolean {
  if (!SUBMITTED_QUERY_LEAD.test(lineText(line))) return false;
  const marker = line.segments.find((segment) => segment.text.includes("›"));
  return marker?.dim === true || line.segments.some((segment) => segment.bg !== undefined);
}

function withoutContinuationIndent(
  line: StyledLine,
  joiner: string,
  indent: number,
): StyledLine["segments"] {
  let remaining = indent;
  let prefixed = false;
  const segments: StyledLine["segments"] = [];

  for (const segment of line.segments) {
    let text = segment.text;
    if (remaining > 0) {
      const drop = Math.min(remaining, text.length);
      text = text.slice(drop);
      remaining -= drop;
    }
    if (!text) continue;
    if (!prefixed) {
      text = joiner + text;
      prefixed = true;
    }
    segments.push({ ...segment, text });
  }

  return segments;
}

function withoutTrailingWhitespace(line: StyledLine): StyledLine {
  let end = line.segments.length;
  while (end > 0 && /^[ \t]*$/.test(line.segments[end - 1]!.text)) end--;

  let changed = end !== line.segments.length;
  const segments = line.segments.slice(0, end);
  const last = segments.at(-1);
  if (last) {
    const text = last.text.replace(/[ \t]+$/, "");
    if (text !== last.text) {
      segments[segments.length - 1] = { ...last, text };
      changed = true;
    }
  }

  return changed ? { ...line, segments } : line;
}

function wrappedJoiner(previous: string, continuation: string): string {
  const before = previous.at(-1) ?? "";
  const after = continuation.trimStart().at(0) ?? "";
  const bothWordCharacters = /[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after);
  const crossesAsciiWord = /[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(after);
  return bothWordCharacters && crossesAsciiWord ? " " : "";
}

function answerContinuationIndent(text: string): number | null {
  if (!ANSWER_LEAD.test(text)) return null;
  return /^(?:•| {2}-)\s+/.exec(text)?.[0].length ?? null;
}

function isAnswerContinuation(text: string, indent: number): boolean {
  const content = text.slice(indent);
  return (
    text.startsWith(" ".repeat(indent)) &&
    content.length > 0 &&
    !/^\s/.test(content) &&
    !NESTED_ANSWER_CONTENT.test(content)
  );
}

function isPlainAnswerParagraph(text: string): boolean {
  if (!PLAIN_ANSWER_ROW.test(text)) return false;
  const content = text.slice(2);
  return !NESTED_ANSWER_CONTENT.test(content) && !STRUCTURAL_ANSWER_CONTENT.test(content);
}

function mergeWrappedLine(previous: StyledLine, continuation: StyledLine, indent: number): StyledLine {
  const trimmed = withoutTrailingWhitespace(previous);
  return {
    ...trimmed,
    segments: [
      ...trimmed.segments,
      ...withoutContinuationIndent(
        continuation,
        wrappedJoiner(lineText(trimmed), lineText(continuation)),
        indent,
      ),
    ],
  };
}

/** Rejoin Codex answer rows that were hard-wrapped to the host PTY before the phone wraps them. */
function normalizeWrappedAnswers(lines: StyledLine[]): StyledLine[] {
  let normalized: StyledLine[] | undefined;
  let insideAnswer = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const text = lineText(line);
    const commandEvent = COMMAND_EVENT.test(text);
    const answerIndent = answerContinuationIndent(text);

    if (
      commandEvent ||
      isCompletionSummary(line) ||
      COMMAND_SUMMARY.test(text) ||
      isSubmittedQueryLead(line)
    ) {
      insideAnswer = false;
    }

    let continuationIndent: number | null = null;
    if (!commandEvent && answerIndent !== null) {
      insideAnswer = true;
      continuationIndent = answerIndent;
    } else if (insideAnswer && isPlainAnswerParagraph(text)) {
      continuationIndent = 2;
    }

    if (continuationIndent === null || line.segments.some((segment) => segment.bg !== undefined)) {
      normalized?.push(line);
      continue;
    }

    let merged = line;
    let joined = false;
    while (index + 1 < lines.length) {
      const next = lines[index + 1]!;
      if (
        !isAnswerContinuation(lineText(next), continuationIndent) ||
        next.segments.some((segment) => segment.bg !== undefined)
      ) {
        break;
      }
      normalized ??= lines.slice(0, index);
      merged = mergeWrappedLine(merged, next, continuationIndent);
      joined = true;
      index++;
    }
    normalized?.push(joined ? withoutTrailingWhitespace(merged) : merged);
  }

  return normalized ?? lines;
}

function compactStatusSegment(text: string): string {
  return text
    // Keep one trailing space so a renderer that permits wrapping still has a break opportunity.
    .replace(/\s+·\s+/g, "· ")
    .replace(/\bContext\s+(\d+)(?:% left|…)/g, "Ctx $1%")
    .replace(/\bApprove(?: for)? me\b/g, "Approve")
    .replace(/\bFast (on|off)\b/g, "Fast:$1")
    .replace(/\bPursuing goal\b/gi, "Goal:active")
    .replace(/\bGoal paused(?:\s+\(\/goal resume\))?/gi, "Goal:paused")
    .replace(/\bGoal stalled(?:\s+\(\/goal resume\))?/gi, "Goal:blocked")
    .replace(/\bGoal hit usage limits(?:\s+\(\/goal resume\))?/gi, "Goal:usage")
    .replace(/\bGoal unmet\b/gi, "Goal:budget")
    .replace(/\bGoal abandoned\b/gi, "Goal:abandoned")
    .replace(/\bGoal achieved\b/gi, "Goal:done");
}

/** Compact only the re-surfaced Codex status strip; detection keeps the captured text verbatim. */
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

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (CONVERSATION_RECAP.test(lineText(line).trim())) {
      normalized ??= lines.slice(0, index);
      normalized.push(line.noWrap ? line : { ...line, noWrap: true });
      continue;
    }

    if (!isCompletionSummary(line)) {
      normalized?.push(line);
      continue;
    }

    normalized ??= lines.slice(0, index);
    normalized.push(line.noWrap ? line : { ...line, noWrap: true });
    while (
      index + 1 < lines.length &&
      DECORATIVE_RULE.test(lineText(lines[index + 1]!).trim())
    ) {
      index++;
    }
  }

  return normalized ?? lines;
}

function codexRawBlock(lines: StyledLine[]): Block {
  return {
    kind: "raw",
    lines: normalizeCompletionSummaries(normalizeWrappedAnswers(lines)),
  };
}

export function codexBuildBlocks(lines: StyledLine[]): Block[] {
  const trust = detectTrustRegion(lines);
  if (trust) {
    const before = trimTrailingBlank(lines.slice(0, trust.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push(codexRawBlock(before));
    blocks.push({ kind: "prompt-select", prompt: trust.model, lines: lines.slice(trust.startLine) });
    return blocks;
  }

  const approval = detectApprovalRegion(lines);
  if (approval) {
    const before = trimTrailingBlank(lines.slice(0, approval.startLine));
    const blocks: Block[] = [];
    if (before.length > 0) blocks.push(codexRawBlock(before));
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
    if (before.length > 0) blocks.push(codexRawBlock(before));
    blocks.push({ kind: "prompt-select", prompt: ask.model, lines: lines.slice(ask.startLine) });
    return blocks;
  }

  return [codexRawBlock(stripChrome(lines))];
}

export { extractStatusLines, extractInputDraft };

export const codexAdapter: HarnessAdapter = {
  agent: "codex",
  buildBlocks: codexBuildBlocks,
  extractStatusLines,
  compactStatusLines: compactCodexStatusLines,
  extractInputDraft,
  composerReady,
  composerPrompt,
  draftCarriesSend: codexDraftCarriesSend,
};
