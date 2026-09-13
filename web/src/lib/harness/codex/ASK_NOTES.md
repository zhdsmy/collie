# Codex `request_user_input` — keystroke recipe

## Current card flow — Codex 0.154.0, verified 2026-09-13

The `codex--v0154-question-*.txt` fixtures were captured from the installed Codex TUI
in a disposable Herdr pane, with a separate temporary configuration and a deterministic
local Responses provider. The provider supplied two tool questions; Codex itself rendered
every frame and handled every key. No external model or daily credentials were used.

The whole painted region, including the leading spacer, `Question X/Y (N unanswered)`
header and wrapped question, becomes a `picker`. The old generic caption and duplicated
raw question disappear. An unanswered question is cyan; a committed question uses the
default foreground. This paint distinction matters when editing a previous answer.

| Card action | Verified native behavior |
| --- | --- |
| Select an option | Up/Down walks one step at a time with guarded read-back; it does not submit. Moving an answered question's pointer invalidates its confirmation and increases the unanswered count. |
| Previous/next question | Left/Right changes the question while retaining each question's selected option. No answer is submitted. |
| Confirm answer | Send the currently pointed digit once, after a fresh full guard. Codex confirms it and advances to the next question. |
| Submit all answers | Send the pointed digit only after every other question is confirmed. Codex sends the entire answer map and closes the card. |
| Native notes | Tab focuses the notes field and the footer changes. That state stays raw; card buttons cannot type into it. |

The digit on the explicit confirmation button is intentional: Enter on the native
`None of the above` row opens notes, while its digit confirms that label directly,
matching the previous Collie behavior. Escape interrupts the entire turn, so question
cards never expose the picker's ordinary Cancel action.

The last-question footer says `submit all` even when earlier questions are unanswered.
Codex would then open `Submit unanswered questions?`; the phone disables its final
button until the earlier questions are confirmed. Header navigation remains available.

Non-blocking requests can acquire an `auto-resolves in …` countdown. This changing header stays
raw so the native deadline remains visible; a timed dialog is never mistaken for a persistent card.
In the live sandbox an untouched second request expired to an empty answer map, and the client
refused every attempted card action on its countdown frame without emitting keys.

The checkout's actual `submitPickerIntent` guard/API modules were exercised against
the disposable pane: confirm question 1, return from question 2, revise question 1,
confirm it again, select question 2, navigate both directions, and explicitly submit.
The completion capture contains the corrected first answer and retained second answer.
A second completed live flow selected `None of the above` in both questions through the same
client actions; the returned map contained that label for both answers, without entering notes.

Source cross-check: `openai/codex` tag `rust-v0.154.0`,
`codex-rs/tui/src/bottom_pane/request_user_input/{mod.rs,render.rs}`.

## Historical digit-only flow — Codex 0.149.0

Captured 2026-08-22 on Codex v0.149.0 in a sandbox pane (feature flag
`default_mode_request_user_input` was enabled in the host config; the tool announces itself as
under development). The card REPLACES the composer. Herdr status: `blocked`.

```
  Question 1/2 (2 unanswered)
  Tabs or spaces?
  › 1. Tabs (Recommended)  Indent code with tab characters.
    2. Spaces              Indent code with space characters.
    3. None of the above   Optionally, add details in notes (tab).
  tab to add notes | enter to submit answer | ←/→ to navigate questions | esc to interrupt
```

The final unanswered question's footer says `enter to submit all` instead. The tool auto-adds
the `None of the above` row; label and description split on a 2+ space run, exactly like the
option rows.

Live-probed, in this session:

| Key | Effect |
|---|---|
| digit `2` (single-question card) | Answered AND submitted immediately — despite the footer's `enter to submit answer` wording. |
| digit `2` (question 1 of 2) | Answered question 1 and advanced to question 2. |
| digit `1` (question 2 of 2) | Answered and submitted the WHOLE set (both answers registered). |
| digit `3` (the auto-added `None of the above` row) | Answered AND submitted `"None of the above"` — the special row confirms like any other (probed through the send path on a two-option card). |
| `tab` | Opens the notes box: a `› Add notes` row appears and the footer flips to `tab or esc to clear notes | enter to submit answer`. A second `tab` leaves it. |
| `esc` | Interrupts the WHOLE conversation ("Conversation interrupted — tell the model what to do differently") — probed on a throwaway card. Never emitted. |

What the adapter emits: one button per option row, `keys: ["N"]` — a digit answers the current
question, which on the last unanswered question submits the set, so multi-question calls step
through as consecutive lifted cards with no extra choreography. The complete captured layout is
required: `Question X/Y (N unanswered)` header, a non-empty question line, consecutive `1..n`
pointer rows, and the notes footer. The NOTES-FOCUSED state refuses to raw (footer
`tab or esc to clear notes`, or a `› Add notes` row): a digit there would type into the box.
Typing notes from the phone is deliberately not offered — it has no probed recipe.
