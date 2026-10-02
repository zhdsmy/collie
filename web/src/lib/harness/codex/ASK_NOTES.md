# Codex `request_user_input` — keystroke recipe

Historical evidence only. Codex QA has stayed native since 2026-09-17; the unused card
detector was removed on 2026-10-02. These probes do not describe current Collie actions.
Current scope: [PICKER_NOTES.md](./PICKER_NOTES.md#scope-2026-10-02). Captures remain for
native rendering and composer-locking regression tests.

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

What the retired adapter emitted: one button per option row, `keys: ["N"]` — a digit answers the current
question, which on the last unanswered question submits the set, so multi-question calls step
through as consecutive lifted cards with no extra choreography. The complete captured layout is
required: `Question X/Y (N unanswered)` header, a non-empty question line, consecutive `1..n`
pointer rows, and the notes footer. The NOTES-FOCUSED state refuses to raw (footer
`tab or esc to clear notes`, or a `› Add notes` row): a digit there would type into the box.
Typing notes from the phone is deliberately not offered — it has no probed recipe.

## Wrapped cards (2026-09-10, Codex 0.153.4)

A read-only inspection found cards with wrapped questions and descriptions. One footer put
`esc to interrupt` on its own final row. The released detector returned null for that card.

The former detector tests applied those layout changes to the public fruit capture through
`parseAnsi → splitLines`. These are synthetic variants, not new byte-faithful captures.
The parser joined question and description rows, kept the original rows in its signature,
and accepted the standalone interrupt hint only directly below the submit footer.
A continuation had to belong to an existing description and start at or beyond its column.
Wrapped labels, incomplete options, notes mode, and output after the footer stayed raw.

No keys were sent to the observed work session. Current `ask.test.ts` retains the wrapped
samples to check native text preservation and composer locking, without card actions.
