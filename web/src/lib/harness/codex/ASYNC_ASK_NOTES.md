# Codex asynchronous question cards

Verified on macOS with the installed Codex CLI 0.154.0 on 2026-09-15. This is the
native `async_questions` editor, separate from the blocking `request_user_input`
questionnaire described in `ASK_NOTES.md`.

## Capture and verification

`codex--async-qa-*.txt` are byte-faithful bridge captures from the disposable Herdr
pane `w6:pJ`, tab `w6:tC`. A loopback Responses provider supplied fixed text. A local
WebSocket proxy added `delivery: "async"` and `questions` to the real app-server's
`item/completed` agent message, producing the native TUI's actual `AsyncQuestions`
state. No production pane, model endpoint or credentials were used. The provider's
tool catalog did not register `request_user_input_async`, so these captures verify
the native UI and delivery path, not the model's tool registration.

The unchanged client `submitPickerIntent` entry point, its live read-back guards,
and the Collie bridge drove both complete question cycles. Checks covered opening,
option movement, returning to the main prompt, navigation in both directions,
multiline Other and freeform answers, CJK and blank lines, replacing an existing
native draft with its caret in the middle, and exactly one Enter per answer.

The terminal buffers contain only synthetic QA text and a disposable directory.
The ordinary draft visible in the replacement captures is from the isolated probe.
Capture bytes, including paint, padding and blank rows, are preserved.

## Native controls

| Visible state / intent | Verified keys and effect |
| --- | --- |
| Collapsed `? N questions`, `⌥ + ↑ to answer` above the ordinary composer | Alt+Up opens question 1; no answer is sent |
| Previous / next unanswered question | Alt+Down / Alt+Up; draft and option selection are retained |
| Question 1, return to main input | Alt+Down collapses; remaining questions are retained |
| Named option or Other | Up/Down moves only the pointer, including when Other owns text input |
| Submit named option | One Enter submits the pointed label; a stored Other draft is ignored |
| Submit Other / freeform | Bracketed paste, verify the full native draft, then one Enter |
| Replace native answer | Bounded Ctrl+U then Ctrl+K sweeps from both sides of the caret; verify empty before pasting |

Ctrl+A/Ctrl+K alone clears only the current line. Ctrl+U alone can remove just one
line or newline. Replacement therefore uses bounded repeated sweeps and refuses
to paste or press Enter unless the same question's focused editor is empty.
Escape is never used to navigate or clear an async answer.

Each accepted answer is removed immediately. The current index stays at the same
position if a later question exists; otherwise it wraps to question 1. Already
submitted answers cannot be revised through the pending queue. Empty freeform
submission does nothing and is disabled in the card. These semantics deliberately
do not reuse the legacy questionnaire's digits, Left/Right, Tab or submit-all flow.

Source cross-check: the matching native `async_questions/{input,state,render}.rs`,
`bottom_pane/questions.rs` and `chatwidget/questions.rs` confirm pointer versus text
focus, pending-question removal and the main-prompt/queue navigation. A collapsed
preview can show a changing countdown; Collie neither starts nor resolves a timer.

## Parsing and safety boundaries

The collapsed entry requires the genuine live composer, painted question count and
dim Alt+Up hint. It does not own the keyboard. The expanded card requires a complete
painted menu at the tail, bold cyan question and pointer, a consistent question
index, and the exact verified submit/skip/navigation footer. Custom keymaps,
truncated menus, unsupported footer flashes and incomplete option windows remain
native. This initial grammar accepts complete option windows up to Codex's 32
suggestions plus Other. It does not infer hidden choices.

The countdown is excluded from the preview's semantic comparison and binding;
the count and ordinary input still participate. All expanded actions retain the
shared pane lease, fresh model comparison and bridge prompt binding. A stale screen,
unverified paste or unverified clear stops the action without a retrying Enter.
Other agents and blocking Codex questionnaires retain their existing parsers.
