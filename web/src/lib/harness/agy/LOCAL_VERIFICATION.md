# AGY 1.4.4 UI check — 2026-10-22

An owned `collie-canary` Herdr session ran installed Antigravity CLI 1.4.4 in a fresh
temporary project. Existing conversations were read only. The test session and project
were removed after the check; no service or existing agent was restarted for sampling.

- At 119 columns, Collie's real SendProtocol submitted one message requesting exactly
  `AGY_CANARY_READY`, with no tools or file edits. The receipt was `sent`, a response
  arrived and the agent settled. The native working footer was sampled during the turn:
  `esc to cancel` is the box's own status hint, not an unknown modal.
- At 38 and 50 columns, native startup and a Chinese draft kept the composer recognized
  and emitted no unread-dialog card. The startup announcement can still take substantial
  space; this change does not fold it or guess at its contents.
- Native `/resume` opened the existing Conversations card. `/model` opened Switch Model,
  which is still an unread-dialog fallback. Escape returned both to an empty composer.
  No model was selected and no existing session was resumed.
- Saved composer/status tails exclude account, path and transcript data. Unit checks also
  exercise a zero-gap hint/model boundary and wrapped working status. Browser replay at
  320/390px checks field separation, the working composer and absence of the unread card.

The rendering change splits the two known fields and retains ANSI styling. It does not
change status lifecycle, notification policy or sending while busy. Actual modal footers,
numbered menus and misplaced cancel hints retain the existing refusal path. This is not
a whole-CLI certification; the send profile remains provisional, and model selection,
approval and question interactions need their own validation when adapted.
