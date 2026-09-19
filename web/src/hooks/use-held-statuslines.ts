import { useEffect, useRef, useState } from "react";

import type { StyledLine } from "@/lib/blocks";

// THE STRIP OUTLIVES THE FRAME THAT CARRIED IT.
//
// ── THE FAULT ───────────────────────────────────────────────────────────────
// The operator, watching a streaming Hermes reply: "有些瞬间 statusline 不见了" — at some moments the
// statusline is gone. Measured rather than guessed: the pane read was sampled 320 times at ~100 ms
// while a reply streamed into an isolated Hermes pane, and 2 of those samples came back as a TORN
// FRAME — every row of the screen except the footer, which was mid-repaint and simply not there yet:
//
//     197  ┊ 💻 $         for i in $(seq 1 200) + 4 commands  13.3s
//     198  ┊ 💻 preparing terminal…          ← the screen's bottom row; no status, no box, no rules
//
// Every consumer of `extractStatusLines` is honest about that: there is no footer in the capture, so
// there is nothing to report, so the strip unmounts for that poll AND THE WHOLE CHROME BELOW IT MOVES
// UP by the strip's height — then back, one poll later. §2 of DESIGN.md calls that fault by name.
//
// ── WHY THE FIX IS A HOLD, HERE ─────────────────────────────────────────────
// It cannot be fixed where the fault is measured. The footer is absent from the buffer the bridge
// returned, so no grammar can find it, and a read-side wait (`awaitPaneReady`, which exists for the
// pre-write case) would put a settle loop on every poll. What CAN be done is to stop treating one
// missing measurement as an instruction to take the strip off the screen — the same call
// `lib/cache-hold.ts` makes for the cache chip, one surface over, and for the same reason: a
// MEASUREMENT can be missing for a poll while the pane it describes has not changed at all.
//
// ── WHAT IT WILL NOT DO ─────────────────────────────────────────────────────
// It holds for one pane address at a time and drops the hold the moment that address changes, so the
// strip can never be one pane's model/ctx over another pane's name — React keeps this subtree mounted
// across a pane switch, which is exactly why `cache-hold.ts` keys its hold and why this one does too.
// A live strip always wins and cancels a pending drop. Nothing is ever invented: the rows shown are
// rows that really were on screen, and the hold has a ceiling so a pane that has genuinely stopped
// painting a footer (the agent exited, or a full-screen TUI took the pane) loses the strip instead of
// showing a stale one forever.
//
// It is deliberately NOT extended to the composer: `hasInputBox` gates a DESTRUCTIVE write, and a held
// "the box was there a moment ago" is a held answer to a question that must be asked live (#34).

/**
 * How long a strip outlives the last frame that carried it.
 *
 * Sized against the two cadences it has to beat: the repaint that tore the frame (Hermes repaints its
 * footer ~10×/s, so a tear is a fraction of a second) and the poll that noticed it (≤1.5 s while a
 * reply streams). This is three polls' worth — comfortable past both — and short enough that a pane
 * which really has stopped painting a footer is corrected within one glance rather than never.
 */
export const STATUSLINE_HOLD_MS = 5_000;

/**
 * The rows to draw for this pane: `rows` when the latest read carried a statusline, otherwise the last
 * rows that did — for up to {@link STATUSLINE_HOLD_MS} — while `key` (the pane address, plus the agent
 * that owns it) stays the same.
 *
 * `key` changing means a different screen owns the strip: the new rows are adopted as they are,
 * including an empty set, and nothing is held across the change. Pass an empty key for a pane the strip
 * does not apply to at all (a shell, or raw-terminal on) — that clears it just as immediately.
 */
export function useHeldStatusLines(key: string, rows: readonly StyledLine[]): readonly StyledLine[] {
  const [held, setHeld] = useState<readonly StyledLine[]>(rows);
  /** The address the current hold belongs to — see the box above for why it is keyed at all. */
  const address = useRef(key);
  /** When the current hold expires, on the wall clock. 0 = no hold in progress. */
  const dropAt = useRef(0);
  /** Whether there is a strip on screen that a torn frame could take away. */
  const holding = useRef(rows.length > 0);

  useEffect(() => {
    if (key !== address.current) {
      address.current = key;
      dropAt.current = 0;
      holding.current = rows.length > 0;
      setHeld(rows);
      return;
    }
    if (rows.length > 0) {
      dropAt.current = 0; // a live strip always wins, and cancels any drop already scheduled
      holding.current = true;
      setHeld(rows);
      return;
    }
    if (!holding.current) return; // nothing on screen to preserve — no timer, no work
    if (dropAt.current === 0) dropAt.current = Date.now() + STATUSLINE_HOLD_MS;
    // Re-armed for whatever is LEFT of the deadline rather than for the whole window again: a tear
    // survives several polls, and re-arming the full window on each of them would postpone the drop
    // for as long as the tear lasts.
    const left = dropAt.current - Date.now();
    if (left <= 0) {
      holding.current = false;
      setHeld([]);
      return;
    }
    const id = window.setTimeout(() => {
      holding.current = false;
      setHeld([]);
    }, left);
    return () => clearTimeout(id);
  }, [key, rows]);

  return held;
}
