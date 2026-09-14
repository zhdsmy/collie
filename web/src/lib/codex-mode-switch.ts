import { fetchPane, fetchSnapshot } from "./api";
import { describeThrownError } from "./api-error-message";
import { parseAnsi, type AnsiSegment } from "./ansi";
import { lineText, splitLines } from "./blocks";
import { sendBoundKeys } from "./dialog-guard";
import { codexAdapter } from "./harness/codex";
import { locateComposer } from "./harness/codex/chrome";
import { normalizeComposerParticles } from "./harness/codex/particles";
import { blockOwnsKeyboard } from "./harness/dialog-contract";
import { defaultSleep, POLL_ATTEMPTS, POLL_DELAY_MS, type Sleep } from "./harness/guard";
import { acquirePaneAction, releasePaneAction, type PaneActionOwner } from "./picker-action";
import { sendGuardedReply, type ReplyOutcome } from "./reply-action";
import type { Scope } from "./scope";

export type CodexMode = "plan" | "fast";

export function isCodexPlanHint(segment: AnsiSegment): boolean {
  return segment.fg === "var(--ansi-5)" && /^Plan mode(?: \([^()]+ to cycle\))?$/.test(segment.text.trim());
}

/** A Fast status item is a complete field, never a substring of another status item. */
function readFastField(segments: readonly AnsiSegment[]): boolean | null {
  // Codex can append its coloured Plan hint directly after Fast without a middle-dot separator.
  // Remove that independently recognised segment before tokenising the remaining status fields.
  const text = segments.filter((segment) => !isCodexPlanHint(segment)).map((segment) => segment.text).join("");
  for (const field of text.trim().split(/\s*·\s*/)) {
    const match = /^Fast[ :]((?:on)|(?:off))$/i.exec(field.trim());
    if (match) return match[1]!.toLowerCase() === "on";
  }
  return null;
}

/** Only the live composer footer can name a mode; transcript mentions never count. */
export function readCodexModeState(text: string) {
  const lines = normalizeComposerParticles(splitLines(parseAnsi(text)));
  const box = locateComposer(lines);
  if (box === null || codexAdapter.buildBlocks(lines).some(blockOwnsKeyboard)) return null;
  const footer = lines[box.statusRow]!;
  const plan = footer.segments.some(isCodexPlanHint);
  // While working, Codex can replace mode information with queue/context hints.
  if (!plan && /(?:to queue|to interrupt|^\s*\d+% context)/i.test(lineText(footer))) return null;
  return {
    plan,
    fast: readFastField(footer.segments),
    draft: codexAdapter.extractInputDraft(lines),
    // Include the mode in the bridge binding: a second device's toggle invalidates our key.
    prompt: lines.slice(box.promptRow, box.statusRow + 1).map((line) => lineText(line).trimEnd()).join("\n"),
  };
}

export interface CodexModeSwitchArgs {
  paneId: string;
  scope?: Scope;
  requestedLines: number;
  codexSessionKey: string;
  mode: CodexMode;
  /** The requested state of `mode`. */
  enabled: boolean;
  signal: AbortSignal;
  sleep?: Sleep;
}

export type CodexModeSwitchResult =
  | { status: "switched"; text: string; revision: number }
  | { status: "blocked" | "changed" | "cancelled" | "unconfirmed" }
  | { status: "error"; error: string };

const SESSION_CHANGED_ERROR = "codex session changed";
const MODE_CHANGED_ERROR = "codex mode changed";
const COMPOSER_BLOCKED_ERROR = "codex composer blocked";

function modeValue(state: ReturnType<typeof readCodexModeState>, mode: CodexMode): boolean | null {
  if (state === null) return null;
  return mode === "plan" ? state.plan : state.fast;
}

function mapFastReply(outcome: ReplyOutcome, signal: AbortSignal): CodexModeSwitchResult | null {
  if (signal.aborted) return { status: "cancelled" };
  if (outcome.status === "sent") return null;
  if (outcome.status === "blocked") return { status: "blocked" };
  if (outcome.status === "stalled") return { status: "unconfirmed" };
  return { status: "error", error: outcome.error };
}

async function verifyComposer(
  args: CodexModeSwitchArgs,
  expectedSession: string,
): Promise<
  | { ok: true; state: NonNullable<ReturnType<typeof readCodexModeState>> }
  | { ok: false; status: "changed" | "blocked"; error?: string }
> {
  try {
    const fresh = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
    if (args.signal.aborted) return { ok: false, status: "changed" };
    if (fresh.codexSessionKey !== expectedSession) return { ok: false, status: "changed" };
    const state = readCodexModeState(fresh.text);
    if (state === null || state.draft !== null) return { ok: false, status: "blocked" };
    return { ok: true, state };
  } catch (error) {
    return { ok: false, status: "blocked", error: describeThrownError(error) };
  }
}

async function sendFast(
  args: CodexModeSwitchArgs,
  owner: PaneActionOwner,
  expected: boolean,
  initialPrompt: string,
): Promise<CodexModeSwitchResult | null> {
  const outcome = await sendGuardedReply({
    paneId: args.paneId,
    text: "/fast",
    agent: "codex",
    scope: args.scope,
    requestedLines: args.requestedLines,
    initialPrompt,
    signal: args.signal,
    sleep: args.sleep,
    owner,
    requireComposer: true,
    onComposerSeen: async () => {
      const fresh = await verifyComposer(args, args.codexSessionKey);
      if (fresh.ok) {
        return modeValue(fresh.state, args.mode) === expected
          ? { ok: true, keysSent: false }
          : { ok: false, error: MODE_CHANGED_ERROR };
      }
      if (fresh.status === "changed") return { ok: false, error: SESSION_CHANGED_ERROR };
      return { ok: false, error: COMPOSER_BLOCKED_ERROR };
    },
  });
  return mapFastReply(outcome, args.signal);
}

/** One bound native toggle or `/fast` command, then read-back only. A lost response never retries. */
export async function runCodexModeSwitch(args: CodexModeSwitchArgs): Promise<CodexModeSwitchResult> {
  const owner = acquirePaneAction(args.paneId, args.scope);
  if (!owner) return { status: "blocked" };
  const sleep = args.sleep ?? defaultSleep;
  try {
    if (args.signal.aborted) return { status: "cancelled" };
    const snapshot = await fetchSnapshot(args.scope, args.signal);
    if (args.signal.aborted) return { status: "cancelled" };
    const agent = snapshot.agents.find((candidate) => candidate.paneId === args.paneId);
    if (
      snapshot.bridge !== "connected" ||
      agent?.agent !== "codex" ||
      (agent.status !== "idle" && agent.status !== "done")
    ) return { status: "blocked" };

    const before = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
    if (args.signal.aborted) return { status: "cancelled" };
    if (before.codexSessionKey !== args.codexSessionKey) return { status: "changed" };
    const state = readCodexModeState(before.text);
    if (state === null) return { status: "blocked" };
    const current = modeValue(state, args.mode);
    if (current === null) return { status: "blocked" };
    if (state.draft !== null) return { status: "blocked" };
    // A desktop change may already have reached the requested mode. No key is needed.
    if (current === args.enabled) return { status: "switched", text: before.text, revision: before.revision };

    if (args.mode === "plan") {
      const sent = await sendBoundKeys(args, ["shift+tab"], state.prompt);
      if (args.signal.aborted) return { status: "cancelled" };
      if (sent.status !== "sent") return sent;
    } else {
      const sent = await sendFast(args, owner, current, state.prompt);
      if (sent !== null) {
        if (
          sent.status === "error" &&
          (sent.error === SESSION_CHANGED_ERROR || sent.error === MODE_CHANGED_ERROR)
        ) return { status: "changed" };
        if (sent.status === "error" && sent.error === COMPOSER_BLOCKED_ERROR) return { status: "blocked" };
        return sent;
      }
      if (args.signal.aborted) return { status: "cancelled" };
    }

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(POLL_DELAY_MS);
      if (args.signal.aborted) return { status: "cancelled" };
      const after = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
      if (args.signal.aborted) return { status: "cancelled" };
      if (after.codexSessionKey !== args.codexSessionKey) return { status: "changed" };
      const next = readCodexModeState(after.text);
      if (modeValue(next, args.mode) === args.enabled) {
        return { status: "switched", text: after.text, revision: after.revision };
      }
      // A new draft means another actor owns the composer; never issue another command.
      if (next?.draft !== null && next?.draft !== undefined) return { status: "changed" };
    }
    return { status: "unconfirmed" };
  } catch (error) {
    return args.signal.aborted ? { status: "cancelled" } : { status: "error", error: describeThrownError(error) };
  } finally {
    releasePaneAction(owner);
  }
}
