# AGY 1.4.4 UI check — 2026-10-22

## Composer command buttons

Both `agy` and `antigravity` use the shared Model / Compact / Resume harness bar.
The command palette also lists `/resume`, whose native Conversations picker was
checked below. Component tests assert each bare command reaches the existing send
callback; 320/390px browser replay checks every button is reachable by scrolling
without overlapping the composer. This change adds no key sequence or menu parser;
compaction is not executed against the user's conversation.

## Chat and composer statusline

The installed 1.4.4 session was read without prompting or restarting it. Its process-held
`presence/<uuid>.lock` names the active conversation exactly, including when newer test
conversations exist in the same workspace. The read-only `conversations/<uuid>.db` reader
found 185 entries (3 user, 180 assistant/tool and 2 compaction summaries), with no unknown
step types. Only native CortexStep fields measured in this version are read. Synthetic
wire-schema tests cover paragraphs, reasoning, non-duplicated answers, tools/errors,
in-place updates, malformed payloads and path containment.

AGY closes/checkpoints its SQLite WAL between writes. Without a WAL, the reader uses an
immutable read-only URI to avoid creating side files and discards a snapshot whose file
metadata changed while reading. With a WAL it uses SQLite's normal read-only connection.
The live window re-reads a bounded tail because native steps can change in place.

Chat and History share the existing journal pipeline; the composer keeps the existing
AGY statusline and native quota fields. `agy--v144-quota--w119.txt` is a transcript-free
tail captured from the installed session; its last cache field is natively truncated.
The 320/390px browser replay checks Chat, one lifted statusline, quota fields and an empty
enabled composer together. Unix session discovery uses the installed `lsof` without DNS
lookups and falls back to the terminal when identity is unavailable; no newest-session
guessing. Windows discovery and native live model streaming are not certified here.

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
- Native `/resume` opened the existing Conversations card. `/model` opened Switch Model,
  which is still an unread-dialog fallback. Escape returned both to an empty composer.
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
a whole-CLI certification; the send profile remains provisional, and model selection,
approval and question interactions need their own validation when adapted.
