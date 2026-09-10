# Hermes CLI display adaptation — 2026-09-10

The source was Hermes CLI v0.21.1 (2026.9.7), upstream `145c713f`, running in Herdr 0.9.0.
An existing completed pane was read with `recent-unwrapped`, ANSI format, without sending input.

`hermes--done.txt` retains the captured ANSI response borders, status fields, prompt suggestion
and composer rules. Its two body paragraphs, model name and session title were replaced with
generic text; it is a sanitized structural fixture, not an unmodified conversation capture.

The official `hermes_cli/cli_stream_mixin.py` prints `╭─ ⚕ Hermes … ╮` (optional timestamp)
and same-width `╰─…╯`. The identified borders fit the phone width on one row while retaining
both rounded ends; unmatched borders, tables, Markdown rules, nested boxes and differently branded
skins remain raw. Row counts before the footer are preserved for latest-reply source-row mapping.
No prose reflow is attempted.

`hermes_cli/cli_status_bar_mixin.py` paints a medical-symbol/model status row, pipe-separated
context and other metrics, optional right-aligned title, then the ruled prompt-toolkit composer.
The context percentage is **used**; `◎` is cache-hit percentage, not context. Status ANSI colors
are retained without the full-width background. Inverse title ink is restored to the title accent.
Unknown status fields are preserved. No hard-coded terminal width or exact RGB theme is required.

The footer must be complete and tail-anchored, with equal-width rules, the Hermes status signature
and an idle `❯` or working `⚕ ❯` prompt (minimal working chrome uses `⚕` alone). Only an empty
input or a verified italic placeholder is hidden; real drafts remain visible.
Menus, torn screens and customized status bars that lack identifying fields retain raw input.

This adapter is **display-only**. `sendGuardedReply` explicitly preserves Hermes' existing
one-shot transport. No composer-ready claim, draft takeover or interactive dialog is enabled;
those require a separately verified input contract. Unit tests pin the unchanged transport and
run the conformance suite against the other harness captures. Browser checks use mocked APIs.

The model field is enriched from the exact Herdr-reported session in Hermes' read-only SessionDB.
Only `model` and the explicit `model_config.reasoning_config` effort are exposed. Disabled reasoning
reads `none`; absent or unknown effort is omitted. The model must match the terminal's full name or
truncated prefix before replacement. This is the last saved session configuration, not a live probe
of provider settings: an in-memory `/reasoning` change appears only after Hermes persists it.
Global config, credentials and other sessions are never used to fill gaps.

Verification: 5,906 frontend tests and 208 targeted backend tests pass, alongside both typechecks,
the root build and full-tree lint. Chromium checks at 320/390 CSS pixels, light/dark and English/Chinese
keep both curved ends visible on one row, retain full model plus effort, and scroll through the
last status field without widening the document. Browser checks also retain a multiline real draft
and restore terminal-width frames in Raw terminal mode. Direct read-only checks resolve the active
Hermes session and its saved full model/high effort. No live send, agent restart or iPhone PWA
interaction is claimed.

## Working footer — 2026-09-10

Hermes v0.21.1's `cli_tui_mixin.py` changes the empty input prompt from `❯` to `⚕ ❯` while
the agent runs; minimal chrome uses `⚕ ` alone. `_tui_placeholder_text` supplies
`msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel`, and `_PlaceholderProcessor` paints it
in the skin's italic placeholder style only when the input is empty. The previous idle-only
prompt match rejected that entire footer and left its metrics and hints in the scrolling mirror.

`hermes--working.txt` is explicitly reconstructed from the sanitized idle capture, that official
renderer and the operator's screenshot. It is not an unmodified live working capture. No prompt
was sent to an active session to manufacture this state.

The adapter accepts those working prompts inside the same complete, tail-anchored ruled footer.
Only the exact italic operation placeholder becomes a second status row; its physical wrapping
is recognized without reflowing arbitrary text. Typed copies, real drafts, unfamiliar hints and
special-state prompts stay visible. The existing fixed status container renders both rows and
allows each to pan horizontally. Idle snapshots remove the hint. The adapter remains display-only
and Hermes sends still use the existing one-shot transport.

Regression coverage includes busy/idle transitions, minimal prompts, wrapped placeholders, real
drafts and malformed footers. The browser case also verifies selected-tab visibility on opening,
resizing and unfolding, preservation of manual tab scrolling across snapshot polls, and stable
status/hint positions while scrolling transcript history. It uses simulated API responses, not
an iPhone PWA or a live send.

## Submitted input rules and hint descenders — 2026-09-10

A read-only ANSI capture of the same Hermes session confirms two 40-character accent rules
around a bold `●` user preview. `_print_user_message_preview` prints the opening rule;
`cli_chat_turn_mixin.py` prints the closing rule after staging the input. The sanitized fixture
`hermes--submitted-input.txt` retains these styles, replaces the message with sample text and
normalizes line endings. The preview may include bold continuation lines, blank lines and dim
timestamps or omitted-line notices. Only a complete matching pair around that styling receives
the `fullWidthRule` display marker; ordinary body rules and unstyled bullets keep their widths.

While wrapping, the mirror draws those separators as full-width strokes using the existing
muted rule color, with equal content gutters. Their original text and source offsets remain in
the rendered tree; wrap-off and raw terminal modes retain terminal geometry. This does not reflow
message text or alter the rounded response frames.

Hermes' unknown text fields, including the italic operation hint, now use normal line height.
The previous single-height line boxes could let glyph descenders reach below the horizontal
scroller's vertical clip. Browser regression checks measure the hint's text range against that
clip and verify both input rules reach the mirror edges with equal gutters.

The operation hints are Hermes-owned CLI vocabulary: `/queue <prompt>` waits for the next turn,
`/bg <prompt>` creates an independent background session, `/steer <prompt>` injects guidance after
the next tool call without interrupting (or queues when idle), and `Ctrl+C` cancels. In this Hermes
version `msg=interrupt` is a fixed placeholder string; actual Enter routing still follows `/busy`
and may redirect the current run, queue the next turn, or steer. Collie preserves that source text.
