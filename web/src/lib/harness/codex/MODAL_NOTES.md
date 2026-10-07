# Codex native modals and the unread-dialog card

Codex's Warnings panel and its own `Submit with unanswered questions?` step stay native: no grammar
reads them. Each gets the unread-dialog card (.adr/0053) because its own footer names Esc as the way
back. In Chat, where no mirror is drawn, that card carries the screen's rows and is the only place
the screen shows. Since 2026-10-08 the Plan prompt and the `/review` pickers have picker cards of
their own (PLAN_NOTES.md, REVIEW_NOTES.md); this file keeps their 2026-10-06 Esc probe.

## Live probe, Codex 0.160.1 (2026-10-06)

One isolated Herdr pane in a scratch git repo, started as
`codex --no-daemon -c 'mcp_servers.collie_canary.command="/usr/bin/false"'` so the failing MCP
server raises a warning. One model turn (Plan mode, one `request_user_input` question) produced the
question and the Plan prompt. Each screen was captured through the bridge, then its key pressed.

| Screen | Footer | Esc, pressed live | Card |
| --- | --- | --- | --- |
| Warnings (`f2`) | `k keep & next · esc dismiss & close · ctrl+o copy · ←/→ warning · ↓ scroll` | closes the panel and dismisses the warning; the statusline count goes | yes, armed as "dismiss" |
| `/review` presets | `enter select · esc back` | back to the input box | yes |
| Plan prompt | `enter select · esc back` | back to the input box, still in Plan mode, nothing implemented | yes |
| Question | `tab to add notes \| enter to submit answer \| esc to interrupt` | not pressed: interrupts the whole turn (ASK_NOTES.md) | no; its own digit card |

Captures: `codex--v0160-warning-idle.txt`, `codex--v0160-warnings-panel.txt`,
`codex--v0160-review-preset.txt`, `codex--v0160-question.txt`, `codex--v0160-plan-prompt.txt`.

The Warnings screen is a panel over the input box, not a full-screen pager. The older captures'
`Press enter to confirm or esc to go back` (0.154 Plan, `/review`) match the same rule.

## The rule

`modalOnScreen` answers true only when one of the last six non-blank rows names Esc as `back`,
`go back`, `cancel`, `close` or `dismiss`, and none says `esc to interrupt`. `esc quit` (folder
trust: it quits Codex), `esc skip` (hooks review) and `tab or esc to clear notes` match nothing, so
those screens keep no card. A question gets none either: its option list is a digit card of
its own (ASK_NOTES.md), and its notes state, where Esc only clears notes, stays native.
