# Codex queue and steering — 2026-10-17

## Own command list — 2026-10-18

The operator's Codex 0.163.0 `/model` receipt stopped at S1 with `changed`, before any
Enter. The v1.22.4 Claude list fix did not configure Codex's completion list. The Codex
profile now names its native list above the composer and reuses upstream's exact-selection
and bounded-scroll checks. No new protocol branch or automatic retry was added.

An isolated Herdr canary opened the native model picker with `keys: ["Enter"]` and a
`sent` receipt. The committed `codex--v0163-slash-model-list.txt` retains the native
completion after a harmless integers-only turn. Normal native scenarios also passed on
the previous release: the original failure was not reproduced exactly. A separate synthetic
four-row wrap regression fails with the list configuration removed and passes with it;
different selections and new checked transcript text remain unsubmitted. This establishes
the missing scroll coverage, not a full certification of every native pane geometry.

The canary and its temporary sibling pane were closed; no input was sent to the operator's
active Codex conversation. Queue/steer defaults and command keys are unchanged.

## Queue and steering

Settings → Device → Sending stores one per-device default shared by Codex and Claude Code
(Queue initially). Ordinary Codex messages use the Send Protocol's `send` (Tab), or
`send, when: steer` (Enter). Commands keep
the existing command route, including the queue/never-held protections during a turn.
A one-off lightning button beside Send remains available when Queue is the default. Other harnesses ignore this shared pref.

The native queue preview offers Steer now for its last ordinary message in both Mirror and Chat.
`steer-queued` checks the latest queue text, empty input and modal guard under the existing
session lock, sends Shift+Left once, checks the restored text and removal of exactly the last
queue entry, then commits Enter. It never retypes the message. Drift stops before Enter and
leaves any restored native draft available. The phone draft is preserved. Replay keeps the same
request id and never repeats recall/submission. Commands and masked text have no promotion button.
Only the last visible native queue item is supported; truncated/unverifiable text stays native.

On actual Herdr/Codex 0.163.0, the owned canary returned queued=true after Tab, then sent after
Shift+Left/Enter, and replied COLLIE_CODEX_STEER_READY. macOS renders the hint as `⇧←`, which the
profile now recognizes alongside textual hints. Evidence:
`/private/tmp/collie-live-send-1792252582073/` and
`/private/tmp/collie-live-send-1792252583198/`; sanitized queue fixture:
`codex--v0163-queued-steer.txt`. No live user Codex conversation received input.
The owned canary exited and its shell pane was closed after verification.

Native behavior references:
[queue recall](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/tui/src/chatwidget/interaction.rs),
[queue removal](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/tui/src/chatwidget/input_restore.rs),
[Enter and Tab](https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/tui/src/bottom_pane/chat_composer.rs).

Validation: affected backend/store/catalog tests (349), frontend Surface/composer/preferences/reply tests
(2,482), both typechecks, lint, build and 66 adaptation fixture replays passed. The 320px Chromium
and WebKit checks cover preference persistence, promotion, preserved drafts and the one-off action;
screenshots are under `/private/tmp/collie-send-e2e/`. These are scoped checks, not whole-CLI certification.
