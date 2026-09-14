import { fetchPane, fetchSnapshot } from "./api";
import { describeThrownError } from "./api-error-message";
import { sendBoundKeys } from "./dialog-guard";
import { defaultSleep, POLL_ATTEMPTS, POLL_DELAY_MS, type Sleep } from "./harness/guard";
import { readClaudeModeState } from "./harness/claude/mode";
import { acquirePaneAction, releasePaneAction } from "./picker-action";
import type { Scope } from "./scope";

// One tap on the Claude statusline's mode = one `shift+tab`, then read back whether the mode text
// moved. Same choreography as the Codex mode toggle (./codex-mode-switch.ts) and deliberately not a
// new one: lease the pane, re-read, bind the write to the region that read produced, send, verify.
//
// WHAT THIS DOES NOT DECIDE. Whether the key does anything. Claude may cycle, may queue the keystroke
// behind a running turn, or may swallow it entirely — so this module never refuses a write because
// the agent is busy, and it never retries one. A mode that did not move inside the poll window is
// reported as `unconfirmed`, which is the honest answer: the key went out and we do not know its
// effect. (The Codex side CAN gate on idle because its composer footer stops naming the mode while
// working; Claude's statusline keeps printing it, hint and all.)

export interface ClaudeModeSwitchArgs {
  paneId: string;
  scope?: Scope;
  requestedLines: number;
  signal: AbortSignal;
  /** Test seam for the bounded read-back polling. */
  sleep?: Sleep;
}

export type ClaudeModeSwitchResult =
  | { status: "switched"; text: string; revision: number; mode: string }
  | { status: "blocked" | "changed" | "cancelled" | "unconfirmed" }
  | { status: "error"; error: string };

/** One bound `shift+tab`, then read-back only. A lost response never retries. */
export async function runClaudeModeSwitch(args: ClaudeModeSwitchArgs): Promise<ClaudeModeSwitchResult> {
  const owner = acquirePaneAction(args.paneId, args.scope);
  if (!owner) return { status: "blocked" };
  const sleep = args.sleep ?? defaultSleep;
  try {
    if (args.signal.aborted) return { status: "cancelled" };
    const snapshot = await fetchSnapshot(args.scope, args.signal);
    if (args.signal.aborted) return { status: "cancelled" };
    const agent = snapshot.agents.find((candidate) => candidate.paneId === args.paneId);
    // The status is deliberately NOT part of this: see the header.
    if (snapshot.bridge !== "connected" || agent?.agent !== "claude") return { status: "blocked" };

    const before = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
    if (args.signal.aborted) return { status: "cancelled" };
    const state = readClaudeModeState(before.text);
    // No input box, no mode row, or a dialog owns the keyboard — the last one is a safety gate, not
    // a nicety: the permission dialog answers `(shift+tab)` with "allow all edits this session".
    if (state === null) return { status: "blocked" };

    const sent = await sendBoundKeys(args, ["shift+tab"], state.prompt);
    if (args.signal.aborted) return { status: "cancelled" };
    if (sent.status !== "sent") return sent;

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(POLL_DELAY_MS);
      if (args.signal.aborted) return { status: "cancelled" };
      const after = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
      if (args.signal.aborted) return { status: "cancelled" };
      const next = readClaudeModeState(after.text);
      if (next !== null && next.mode !== state.mode) {
        return { status: "switched", text: after.text, revision: after.revision, mode: next.mode };
      }
    }
    return { status: "unconfirmed" };
  } catch (error) {
    return args.signal.aborted ? { status: "cancelled" } : { status: "error", error: describeThrownError(error) };
  } finally {
    releasePaneAction(owner);
  }
}
