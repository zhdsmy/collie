# AGY 1.4.4 / 1.4.5 UI checks — 2026-10-22

## Resume send and card — AGY 1.4.5
At 50 columns, opening slash completion after leaving Model retained the first
banner rows while clipping three middle rows. SendProtocol previously accepted
only a contiguous scroll from the top and refused `/resume` as
`typed_not_submitted: changed`. Its existing command-list path now also accepts
bounded deletion in order, with at least two transcript anchors and unchanged
last rows beside the composer. New output, reordering, excessive deletion,
changed boundary, a different pointed command and unknown dialogs still refuse
Enter. Other send paths do not receive this allowance.

The native Conversations card also accepts the custom rich statusline and the
50-column footer starting with `Keyboard: enter Select`; the list's existing
pointer still identifies arrow navigation. Select/Escape remain printed keys;
Rename/Delete are not added as buttons. Old layouts keep their tests.

Owned Herdr sessions at 50/119 columns verified Model then Resume via the actual
client and SendProtocol. All four receipts were `sent`, each with `probe`,
`Backspace` and exactly one `Enter`. Resume then passed Down, Up and Escape via
`submitMenuKeys` and bridge `keysPane`; the pointer moved both ways and returned
to its original row, then the menu closed to an empty composer. No existing
conversation was resumed and no provider inference was used.

The 50-column before/after completion pair and both Conversations menus are
captured as `agy--v145-{idle-after-model,slash-resume}--w50.txt` and
`agy--v145-resume--w{50,119}.txt`. Account/project are sanitized; conversation
labels are masked while preserving ANSI, spacing and pointers. 320px
Chromium/WebKit replay checks all four controls, absence of the unread card,
and page width; screenshots are emitted by `web/e2e/agy-chrome.spec.ts`.
This checks Resume opening/navigation/cancellation, not whole-CLI behavior or
resuming another user's saved history. The send profile remains provisional.

## Model picker card
The shared MenuBlock now recognizes Switch Model from its title, Search, one
highlighted model and native Keyboard footer. The ANSI body remains visible;
Up/Down moves the model, Left/Right adjusts the painted active Effort, Enter
selects, and Escape is offered only when printed. A clipped 50-column footer
still lifts the menu. Missing anchors or appended unknown prompts refuse the
card. No-match search remains the native fallback instead of offering Select.

AGY 1.4.4's sanitized 119/50-column captures are checked in as
`agy--v144-model--w{119,50}.txt`. Tests cover both adapter aliases, missing paint,
unknown tails and a moved highlight: stale Select is refused while navigation
uses the shared identity guard. 320px Chromium/WebKit replay shows model names,
four arrows, Select, and only the advertised Escape without an unread warning
or page overflow. Screenshots are emitted by `web/e2e/agy-chrome.spec.ts`.

During this check the installed CLI updated to 1.4.5. Owned native Herdr sessions
at 119/50 columns verified Down, Up, Left and Right through the actual
`submitMenuKeys` client and bridge `keysPane` (including prompt binding). Every
key changed the expected native selection; Effort returned to its initial high
value. Wide-menu Escape used the same guarded action; the narrow menu's clipped
Escape stayed keyboard-only. Both returned to an empty composer. No different
model was selected and no provider inference was requested. Owned panes,
projects and temporary native trust/cache entries were removed; user sessions
and services were preserved.

The supplementary narrow Resume send failure found during the model-card check
is resolved by the later Resume verification above.

## Composer command buttons

AGY 1.4.4's native completion list is recognized before Enter, including its
navigation footer. The send protocol counts this known footer when the list scrolls
a full transcript; no extra Enter or relaxed transcript comparison is used. A
sanitized composer tail from the affected pane is
`agy--v144-slash-model--w119.txt`. Protocol replay covers Model / Compact / Resume
on a full transcript, a different pointed command, and an unexpected dialog.

An owned Herdr canary session verified Model and Resume through the actual client
send function and SendProtocol at 119 and 50 columns. All four receipts were `sent`
with `probe`, `Backspace`, and exactly one `Enter`; native Switch Model and
Conversations appeared, and Escape returned to an empty composer. No model was
selected, no history was resumed, and no provider inference was requested. The
owned session and project were removed. That earlier command-send check left the
model menu as native fallback; the later model-card check above supersedes it.

Both `agy` and `antigravity` use the shared Model / Compact / Resume harness bar.
The command palette also lists `/resume`, whose native Conversations picker was
checked below. Component tests assert each bare command reaches the existing send
callback; 320/390px browser replay checks every button is reachable by scrolling
without overlapping the composer. This change adds no key sequence or menu parser;
compaction is not executed against the user's conversation.

## Chat and composer statusline

Read-only verification on 2026-10-22 used the installed AGY 1.4.4 process and its
`presence/<uuid>.lock`; no prompt, restart, or conversation migration was needed.
The earlier SQLite session yielded 185 entries. The current session instead had an
empty `.db` and a growing `.pb`: AGY's own log reported `set user_version: database
is locked` during creation, then selected its fallback backend. Before this fix,
Collie's Chat and History routes returned `no-session` and Chat displayed the mirror.
The cause of that native database lock was not established.

The reader now selects a populated SQLite database first, then the same conversation's
native `.pb`. The fallback is AES-256-GCM authenticated with AGY's **public fixed format
key**, not a user credential. Its embedded cascade ID must match the process-selected
filename. Reuse of the existing CortexStep parser recovered 381 entries from 464 steps
(2 user, 376 assistant/tool, 3 summaries). Three type-101 steps remain in the unknown-type
tally; no unsupported step is guessed into a message. Only measured native fields are
projected, so this is not a lossless transcript export.

Format provenance: [agy-reader's native fallback reader](https://github.com/mjacobs/agy-reader/blob/main/internal/completeness/legacy.go),
[public format key](https://github.com/mjacobs/agy-reader/blob/main/internal/completeness/legacy_key.bin),
and [AGY 1.4.4 verification](https://github.com/mjacobs/agy-reader/blob/main/docs/compatibility/agy-1.4.4-legacy-verification.md).
Collie reuses its existing bounded protobuf parser and Node crypto, with no new dependency,
daemon, export job, or persisted plaintext. Synthetic tests cover authenticated corruption,
identity mismatch, containment, empty-database fallback, later SQLite migration, mutable
updates and stable indexes beyond 1024 steps. Fallback files above 32 MiB or 10,032 top-level
fields remain unreadable rather than bypassing the bounds.

AGY closes/checkpoints its SQLite WAL between writes. Without a WAL, the reader uses an
immutable read-only URI to avoid creating side files and discards a snapshot whose file
metadata changed while reading. With a WAL it uses SQLite's normal read-only connection.
Chat and History share the existing journal pipeline; session discovery never chooses the
newest conversation in a shared directory. Windows discovery and native live model streaming
are not certified here.

The local stdin-only statusline keeps both quota families and reset times, shortens them to
`Gemini` and `Claude/GPT`, and uses `in`/`out` counters. It still delegates model/context/git/
version to the existing Claude-compatible script. No quota polling or currency estimate is
introduced. Collie's AGY statusline reuses the shared icon field and context ring for modes,
activity, key hints, context, quota windows and counters; full native labels remain in titles
and accessible names, and unrecognized fields stay visible. The original native captures
remain unchanged. Synthetic rich-line replay at 320/390px covers one horizontal strip, an
enabled composer, quota fields and the separate Chat stream.

## Previous send verification

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
- Native `/resume` opened the existing Conversations card. `/model` originally used
  the unread-dialog fallback, superseded by the model-card check above. Escape returned
  both to an empty composer.
  No model was selected and no existing session was resumed.
- Saved composer/status tails exclude account, path and transcript data. Unit checks also
  exercise a zero-gap hint/model boundary and wrapped working status. Browser replay at
  320/390px checks field separation, the working composer and absence of the unread card.
- Native settings were changed to Auto and Queued Messages → Send Immediately. With the
  same settings in an owned session, the real SendProtocol returned `sent` for an initial
  request and a follow-up sent after observing `working`; `AGY_STEER_READY` arrived and the
  agent settled. Framed sends use native Enter, leaving Queue/Send Immediately to AGY.
  Commands during a turn and frameless busy sends retain their guards. `alt+m` is the
  opposite of the user's native setting, so it is deliberately not a fixed queue key.
- Auto's gray ANSI-8 ghost hint is an empty composer, not a draft. Its captured tail is
  `agy--v144-auto-placeholder--w119.txt`; the same words in ordinary paint and a mix of
  ghost paint with typed text remain real drafts. The profile stays provisional.
- A local command statusline reuses the installed Claude renderer and native JSON fields
  for mode, state, model, context remaining, branch, version, cumulative input/output and
  last-request cache ratio. The rich native row remained a single scrollable statusline;
  no unread card was produced. Cache ratio is not a promise that the next request is hot.

A single no-tools headless Argon Medium probe took 11.6 seconds wall time: first text at
8.4 seconds, last text at 10.4 seconds, 234 output tokens, zero thinking tokens. This is
one short streaming sample, not a throughput guarantee. The existing long conversation
showed multi-minute thought stages and many tool/model calls; no model HTTP 429/5xx was
found in its sampled log. Medium was retained; no provider or proxy was changed.

The rendering change splits the two known fields and retains ANSI styling. It does not
change status lifecycle or notification policy. Actual modal footers,
numbered menus and misplaced cancel hints retain the existing refusal path. This is not
a whole-CLI certification; the send profile remains provisional. Committing a
different model, approval and question interactions are not certified here.
