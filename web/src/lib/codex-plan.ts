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
import { acquirePaneAction, releasePaneAction } from "./picker-action";
import type { Scope } from "./scope";

export function isCodexPlanHint(segment: AnsiSegment): boolean {
  return segment.fg === "var(--ansi-5)" && /^Plan mode(?: \([^()]+ to cycle\))?$/.test(segment.text.trim());
}

/** Only the live composer footer can name a mode; transcript mentions never count. */
export function readCodexPlanState(text: string) {
  const lines = normalizeComposerParticles(splitLines(parseAnsi(text)));
  const box = locateComposer(lines);
  if (box === null || codexAdapter.buildBlocks(lines).some(blockOwnsKeyboard)) return null;
  const footer = lines[box.statusRow]!;
  const enabled = footer.segments.some(isCodexPlanHint);
  // While working, Codex can replace mode information with queue/context hints.
  if (!enabled && /(?:to queue|to interrupt|^\s*\d+% context)/i.test(lineText(footer))) return null;
  return {
    enabled,
    draft: codexAdapter.extractInputDraft(lines),
    // Include the mode in the bridge binding: a second device's toggle invalidates our key.
    prompt: lines.slice(box.promptRow, box.statusRow + 1).map((line) => lineText(line).trimEnd()).join("\n"),
  };
}

export interface CodexPlanSwitchArgs {
  paneId: string;
  scope?: Scope;
  requestedLines: number;
  codexSessionKey: string;
  enabled: boolean;
  signal: AbortSignal;
  sleep?: Sleep;
}

export type CodexPlanSwitchResult =
  | { status: "switched"; text: string; revision: number }
  | { status: "blocked" | "changed" | "cancelled" | "unconfirmed" }
  | { status: "error"; error: string };

/** One bound native toggle, then read-back only. A lost response must never toggle twice. */
export async function runCodexPlanSwitch(args: CodexPlanSwitchArgs): Promise<CodexPlanSwitchResult> {
  const owner = acquirePaneAction(args.paneId, args.scope);
  if (!owner) return { status: "blocked" };
  const sleep = args.sleep ?? defaultSleep;
  try {
    if (args.signal.aborted) return { status: "cancelled" };
    const snapshot = await fetchSnapshot(args.scope, args.signal);
    if (args.signal.aborted) return { status: "cancelled" };
    const agent = snapshot.agents.find((candidate) => candidate.paneId === args.paneId);
    if (snapshot.bridge !== "connected" || agent?.agent !== "codex" ||
      (agent.status !== "idle" && agent.status !== "done")) return { status: "blocked" };
    const before = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
    if (args.signal.aborted) return { status: "cancelled" };
    if (before.codexSessionKey !== args.codexSessionKey) return { status: "changed" };
    const state = readCodexPlanState(before.text);
    if (!state || state.draft !== null) return { status: "blocked" };
    // A desktop change may already have reached the requested mode. No key is needed.
    if (state.enabled === args.enabled) return { status: "switched", text: before.text, revision: before.revision };
    const sent = await sendBoundKeys(args, ["shift+tab"], state.prompt);
    if (args.signal.aborted) return { status: "cancelled" };
    if (sent.status !== "sent") return sent;

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(POLL_DELAY_MS);
      if (args.signal.aborted) return { status: "cancelled" };
      const after = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
      if (args.signal.aborted) return { status: "cancelled" };
      if (after.codexSessionKey !== args.codexSessionKey) return { status: "changed" };
      const next = readCodexPlanState(after.text);
      if (next?.enabled === args.enabled) return { status: "switched", text: after.text, revision: after.revision };
      if (next && next.draft !== null) return { status: "changed" };
    }
    return { status: "unconfirmed" };
  } catch (error) {
    return args.signal.aborted ? { status: "cancelled" } : { status: "error", error: describeThrownError(error) };
  } finally {
    releasePaneAction(owner);
  }
}
