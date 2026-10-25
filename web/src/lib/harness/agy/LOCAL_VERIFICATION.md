# AGY 1.4.4 / 1.4.5 / 1.4.7 UI checks — 2026-10-26

## Mid-turn Sending (`Queue` / `Steer`) — AGY 1.4.7 (2026-10-26)

An owned AGY 1.4.7 Herdr canary (`collie-canary`) exercised mid-turn `Queue` and
`Steer` sends via `sendText` and `SendProtocol`:

- **Native key mapping and `~/.gemini/antigravity-cli/settings.json` awareness:**
  AGY 1.4.0+ supports both mid-turn `Queue` and `Send Immediately` (`Steer`),
  flipping `Enter` and `Alt+M` (`\x1bm`) based on `queuedMessages` in
  `~/.gemini/antigravity-cli/settings.json`:
  - When `queuedMessages` is `"queue"` (or absent, AGY's default): `Enter` queues
    and `alt+m` steers (`enterWhileRunning: "queues"`, `steer: ["alt+m"]`).
  - When `queuedMessages` is `"send-immediately"`: `applyAgySendSettings` in
    `bridge/agy-settings.ts` dynamically overrides the profile keys to
    `enterWhileRunning: "steers"`, `queueKey: "alt+m"`, and `steer: ["Enter"]`.
- **Distinct screen witnesses (`agy.json`):**
  - Queued messages draw `▸ <text>` directly beneath the braille spinner row
    (`^[⠀-⣿]\s+\S`) above the composer box with no sub-row (`queuedRow` with
    `hintAbove: true`).
  - Steered messages draw `▸ <text>` followed immediately by
    `  ⎿  Sending to agent...` (`steerWitness[0]`, `hintGap: 0`) before landing
    in the transcript as `> <text>` (`steerWitness[1]`, `transcript: true`).
- **Shared Collie `Sending` preference (`runningSendMode`):**
  `Composer` (`runningSendChoice`) now includes `agy` and `antigravity` alongside
  `codex` and `claude`, honoring `Settings → Device → Sending (Queue / Steer)`
  and offering the one-off `Steer now` action when `Queue` is selected.
- Live verification in `collie-canary` confirmed `sendText` without `when`
  produced `outcome: "sent", queued: true` (`reading.note: "queued"`) and
  `sendText` with `when: "steer"` produced `outcome: "steered"`
  (`reading.note: "steered"`). The owned canary session and temporary workspace
  were removed; user sessions received no input.

## Model stability, `/effort` scale chips, wide `/resume`, and native `Keyboard:` modals — AGY 1.4.7 (2026-10-24)

An owned AGY 1.4.7 Herdr canary (`collie-canary`) exercised `Switch Model`
(`/model`), `Set Effort` (`/effort`), `Conversations` (`/resume`), and the
remaining native `Keyboard:` modals (`/rewind`, `/agents`, `/skills`, `/tasks`,
`/mcp`, `/settings`, `/permissions`) at 119 and 50 columns.

- **Root causes of `Switch Model` (`/model`) and `Conversations` (`/resume`)
  instability in AGY 1.4.7:**
  1. In AGY 1.4.7's default `auto` mode, the initial statusline omits the `auto`
     token between the model name and state (`Gemini 4 Argon (High)  idle  ctx 100%  v1.4.7`).
     `STATUS` in `model.ts`, `conversations.ts`, `artifact.ts`, and `modals.ts`
     now makes the mode token optional so `Switch Model` and `Conversations`
     never fail closed when opened in default mode.
  2. When moving the highlight onto or off a model with fixed effort (such as
     `GPT-OSS 120B (Medium)` in AGY's `Switch Model`, or `Haiku` in Claude's
     `Select model`), the secondary `←/→ Effort` gauge disappears and reappears.
     Previously, `menusSameIdentity` required `Boolean(a.nav.leftRight) === Boolean(b.nav.leftRight)`,
     causing `submitMenuKeys` (`nav: true`) to fail with `status: "changed"` on
     rapid `Up`/`Down` taps across a fixed-effort row, and causing the `[ ↑ ]` /
     `[ ↓ ]` buttons to jump horizontally when `[ ← Effort → ]` appeared or
     disappeared. `menusSameIdentity` now allows `leftRight` presence to vary in
     an `upDown` list without a printed scale (`values === undefined`), and
     `<MenuBlock>` stacks `[ ↑ ] [ ↓ ]` and `[ ← label → ]` onto separate rows
     so the primary vertical arrows stay fixed under the user's thumb (`DESIGN.md §2`).
  3. `model.ts` now joins wrapped `Keyboard:` continuation lines across all
     terminal widths, accepts `tab Context` and `esc Clear search` (`Clear search`
     action), and removes the false `|\?\s*$` rejection on model rows.
  4. `conversations.ts` fixed an off-by-one loop bound (`i = escRow` and
     `texts.slice(keyboard, escRow + 1)`) so `/resume` (`Conversations`) lifts
     cleanly on wide terminals (`>= 134` columns) where the entire `Keyboard:`
     legend fits on a single row.
- **`/effort` (`Set Effort` — `EffortSelectorModel`):**
  `detectEffortSelectorRegion` in `model.ts` lifts AGY 1.4.7's standalone
  `/effort` modal (`Set Effort`) with `leftRight: { verb: "Effort", label, values: ["low", "medium", "high"] }`,
  rendering tappable scale chips (`[ low ] [ medium ] [ high ]`) plus `Select`
  (`Enter`) and `Go back` (`Escape`), matching Claude Code's `/effort` card.
  The non-adjustable notice (`Effort isn't adjustable for the current model`)
  lifts as a dismissible `Go back` (`Escape`) card.
- **Native `Keyboard:` modals (`modals.ts`):**
  Because `dialogUnder` in `chrome.ts` blocks `composerReady` whenever
  `^Keyboard:\s` appears below the dormant composer box, any unadapted
  `Keyboard:` modal previously dropped onto the yellow `unread-dialog` warning.
  `detectAgyModalRegion` in `modals.ts` conservatively lifts `/rewind`
  (`Rewind Conversation`), `/agents` (`Available Agents`), `/skills` (`Skills`),
  `/tasks` (`Tasks` / `Task Details`), `/mcp` (`MCP Servers`), `/settings`
  (`Settings`, including `leftRight: { verb: "Change" }`), and `/permissions`
  (`Permission Config Editor` / `Permissions — ...`) into `MenuModel` cards with
  safe navigation, `Enter`, and `Escape`, while omitting destructive single-key
  shortcuts (`k Kill Active Subagent`, `k Kill Task`, `x Remove Task From List`,
  `d Delete rule`).
- **Statusline preservation & command palette:**
  `extractStatusLines` in `chrome.ts` now preserves the bottom statusline across
  `detectModelRegion`, `detectConversationsRegion`, `detectArtifactRegion`, and
  `detectAgyModalRegion`. `agent-commands.ts` sets `takesArg: false` on `/model`
  and `/mcp` so tapping them opens the picker immediately, and adds `/effort`,
  `/rewind`, `/agents`, `/tasks`, `/settings`, and `/permissions`.
- Sanitized captures from the owned canary are checked in as
  `agy--v147-effort--w{119,50}.txt`, `agy--v147-model-fixed-effort--w119.txt`,
  `agy--v147-rewind--w119.txt`, `agy--v147-agents--w119.txt`,
  `agy--v147-skills--w119.txt`, `agy--v147-tasks--w119.txt`,
  `agy--v147-mcp--w119.txt`, `agy--v147-settings--w119.txt`, and
  `agy--v147-permissions--w119.txt`. The owned canary session and temporary
  directories were removed; user sessions received no input.

## Artifact review and detail viewer — AGY 1.4.7 (2026-10-24)

An owned AGY 1.4.7 Herdr canary in `plan` mode produced artifacts with
`RequestFeedback=true` (`implementation_plan.md` and `checklist.md`) and entered
native `reviewing` state at 119 and 50 columns.

- When `/artifact` opens `ArtifactViewModel` (`Action required (N left)` or
  `Artifacts`), a dormant `─── / > / ───` composer box remains painted above the
  modal while `Keyboard: ...` sits at the bottom above the statusline.
  `dialogUnder` now treats `^Keyboard:\s` below the composer box as a modal tail
  so `locateInputBox` / `composerReady` fails closed instead of claiming the
  dormant composer.
- `detectArtifactRegion` lifts `ArtifactViewModel` into a `MenuModel` card
  across all three native sub-states:
  1. Active review (`Action required (N left)`): `Approve` (`y`), `Reject` (`n`),
     `Preview` (`p`), `Open` (`Enter`), and `Done` (`Escape`), plus `Up`/`Down`
     when multiple artifacts are listed.
  2. Confirm-exit prompt (`Submit  Dismiss` with inverse-painted pill):
     `Submit` (`Enter` or `Tab` + `Enter`) and `Dismiss` (`Escape`).
  3. Non-review artifact list (`Artifacts`): `Preview` (`p`), `Open` (`Enter`),
     and `Dismiss` (`Escape`), plus `Up`/`Down`.
- Pressing `Enter` on an artifact opens `ArtifactDetailModel` (` <name> [pct%]` or
  ` <name> — Outline` with a bottom shortcut bar). It lifts into a `MenuModel`
  card with `Up`/`Down` and state-appropriate actions (`Outline` `t`, `Hide lines`
  / `Show lines` `l`, `Close` `Escape` in document view; `Jump` `Enter` and
  `Back` `Escape` in outline view; `Send & close` `y`, `Discard & close` `n`, and
  `Cancel` `Escape` on the unsent-comments prompt).
- `<StatuslineRow>` (`AGY_FIELDS` / `AGY_STATE_RE`) and the statusline matchers
  in `model.ts` / `conversations.ts` now recognize `reviewing` (`ListChecks`),
  `error` (`CircleAlert`), and `merging` (`Hourglass`). `/artifact` is also listed
  in AGY's slash-command palette (`agent-commands.ts`).
- Sanitized captures from the owned canary are checked in as
  `agy--v147-reviewing-idle--w119.txt`,
  `agy--v147-artifact-review--w{119,50}.txt`,
  `agy--v147-artifact-review-preview--w119.txt`,
  `agy--v147-artifact-review-submit--w50.txt`,
  `agy--v147-artifact-list--w119.txt`, and
  `agy--v147-artifact-detail--w{119,50}.txt`.
  The owned canary session, temporary project directories, and temporary native
  state were removed; user sessions received no input.

## Background task rail — 2026-10-23

An owned AGY 1.4.5 Herdr canary reproduced the operator's screenshot with one
background `sleep 25; printf ...` command. Its task row is `  ● [HH:MM:SS] ... running`,
between the composer's bottom rule and another equal-width rule above status.
The reader took that second rule for the composer bottom, so both the input
claim and fixed status were lost and the unread card appeared. The command
completed; the canary session and project were removed. User sessions received
no input. The local original capture is in `/private/tmp/collie-agy-background-evidence/`.

The shared frame reader now steps across only a bounded, profile-named footer
between matching rules. AGY reuses that frame, leaves task progress at its source
rows in Mirror and extracts only the final statusline. Unknown rows, mismatched
rules, excessive tasks and modal tails retain refusal. The send protocol replay
checks one Enter while task timestamps change; no sending shortcut was added.

The sanitized native tail is `agy--v145-background-task--w80.txt`; 320/390px browser
replay checks progress, status and absence of the unread card. This is a live
reproduction plus parser/protocol/browser replay, not a new live send through
the repaired reader or whole-version certification. The profile stays provisional.

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

The local stdin-only statusline places model/effort first and the CLI version last, keeps
both quota families (`Gemini` and `Claude/GPT`) with reset times, and omits cumulative
token counters and cache hit ratios. It still delegates model/context/git/version to the
existing Claude-compatible script. No quota polling or currency estimate is introduced.
Collie's AGY statusline shows `Auto` / `Ask` / `Edit` / `Plan` for the native `auto` /
`default` / `accept-edits` / `plan` modes, keeping the native token in the accessible name
and tooltip. It aligns `idle` (`CircleCheck`) and active turns (`Hourglass` with the same
4.8-second keyframes as Codex), reuses the context ring, labels quota windows `5h` / `7d`
with remaining percentages and reset countdowns, places model first/version last, and drops
legacy `in`/`out`/`cache` fields while keeping unrecognized fields visible. The original
native captures remain unchanged. Synthetic rich-line replay at 320/390px covers one
horizontal strip, an enabled composer, quota fields and the separate Chat stream.

### State and quota follow-up (AGY 1.4.5)

An owned session sampled native `authenticating`, `idle` and `working` payloads.
The local script previously filtered `authenticating`; it now preserves nonempty native
state/mode values, and uses `idle` for missing/empty state as the
[official example](https://github.com/google-antigravity/antigravity-cli/blob/main/examples/statusline/statusline.sh)
does. Unknown states remain text instead of disappearing. The authentication state uses
the shared active-state hourglass. A no-tools request was interrupted with Escape and
polled until the native strip returned to idle; the isolated session/project were removed.

Nine script payload checks cover missing/empty, known and unknown states without changing
quota percentages or resets. At 20%/10% remaining, quota text uses the existing warning
and blocked theme colors. Full window labels and numbers remain visible; unknown or
incomplete native fields retain their text. Native terminal truncation cannot recover a
reset time that was never captured. No queue, permissions or sandbox setting was changed.

Current native mode tokens are `auto`, `default`, `accept-edits`, and `plan` (installed
1.4.5 help/strings and settings). `--dangerously-skip-permissions` and sandbox are
independent controls, not additional cycle modes. Browser checks cover 320/390px in
Chromium/WebKit, including startup, working and interruption; 124 statusline component
checks and AGY conformance pass. The main bundle crossed Workbox's 2 MiB per-file limit;
the build now uses a bounded 3 MiB limit and verifies the application is in the precache.
No installed iPhone PWA or production AGY restart is part of this check.

## Command permission and fixed statusline (2026-10-22)

- Native AGY 1.4.4, 80 columns: an owned canary requested a harmless scratch-file
  command in `accept-edits` mode. Collie recognized all four permission choices even
  with Codex and Hermes named in the preceding conversation. The wrapped command prefix
  and persistence description remain available on their respective buttons.
- `submitPromptOption` sent only digit `4` through the real guarded `/keys` handler.
  The dialog closed and the scratch file did not exist. The isolated session/project
  were removed. Approval and persistent allow were deliberately not exercised.
- Permission/question footers now supply the fixed native statusline when the composer
  is absent. Composer readiness and prompt guards are unchanged. Explicit foreign TUI
  markers still reject the screen; a separator cannot join separate numbered lists.
- The canary fetch shim now routes `/keys` through the existing server handler and
  retains its owned-pane restriction. This changes no production API.
- Chromium and WebKit replay at 320/390px passed for permission, Model, Resume,
  working statusline and Chat (18 cases). Permission screenshots retain the wrapped
  descriptions, a single fixed statusline and the successful guarded decline action.
  This is desktop browser emulation, not an installed iPhone PWA check.

## Earlier send checks

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
