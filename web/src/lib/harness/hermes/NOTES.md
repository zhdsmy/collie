# Hermes CLI display adaptation — 2026-09-10

## Startup and resume announcements share read-only cards — 2026-09-16

The native startup panel has a bold `Hermes Agent v…` heading, a rounded full frame,
`Available Tools`, and the `N tools · M skills · /help for commands` count row. Only a
complete matching frame folds. The standard six-row painted logo and a simple adjacent shell
launch command join it when the command's resume ID matches the panel's Session field.
Unknown branding, cropped frames, earlier session-exit statistics and unframed warnings stay raw.
The expanded banner keeps its terminal columns and can pan horizontally inside the card.

`cli_agent_setup_mixin.py` prints the resume announcement with a bold session ID; its prefix
is not always bold. Only a styled, immediately adjacent announcement belongs to the verified
history panel. Up to three Rich-wrapped rows are accepted. The card summary uses the title and
user-message count; the full ID and total count remain in the body, without changing the text.

`cli.py` prints the standard Welcome after replay, then startup prewarm warnings and a random
tip. The exact welcome and adjacent dim `✦ Tip:` row can append visually to the startup card.
Intervening warnings or unknown text stop that tail. This is an intentional visual regrouping;
the raw blocks and all their source rows retain native order for latest-reply subtraction.
`AnsiOutput` renders find/link offsets in that order before nesting the tail under its card.
If subtraction removes the startup card, an orphaned tail renders as ordinary text.

Tests cover source-row mapping, refusal, metadata wrapping, independent folds and search into
the relocated tip. The browser spec uses the sanitized startup/replay fixture in Chinese,
English and German at 320/390px on Chromium and WebKit; it checks card summaries, bounded
scrolling, no native writes or composer focus, and actual search scrolling into the startup tail.

## Resume history folds without taking keyboard ownership — 2026-09-16

Hermes v0.21.2 (2026.9.11, `1021a032`) replays recent exchanges through
`cli_agent_setup_mixin.py`'s `_display_resumed_history()`: a Rich panel titled
`Previous Conversation`. This is history, not necessarily a generated summary. It includes
user/assistant messages, tool summaries and context events; its final assistant message is
restored in full even when earlier entries are truncated, explaining the unusually long panel.

Read-only inspection of the operator's resumed `w7:p9` pane found an incomplete 174-column
panel followed by a complete 211-column repaint. Only the complete 59-row panel folds.
Recognition requires the native dim title, rounded frame, equal-width top/bottom rules,
framed interior and a native role/event marker. Unknown or incomplete panels remain raw.
The checked-in fixture comes from the installed renderer with synthetic history; the private
live capture is not committed. See the fixture README for provenance.

The card starts collapsed and scrolls internally when expanded. It retains ANSI role colors,
literal text and blank lines; it does not guess Markdown or reverse terminal hard wrapping.
This is metadata on a raw block, not a dialog: search still includes the body and opens it,
and no keys, input focus or composer-ready claims are added. Removed border rows become
blank rows so latest-reply subtraction keeps its source coordinates; a partially subtracted
panel loses its folding metadata. Raw terminal mode bypasses the transformation.

Parser/component tests cover refusal, row mapping, search and stable expansion across polling.
The browser spec checks narrow Chinese/English/German layouts in Chromium and WebKit with
mocked APIs, internal scrolling and zero reply/key requests. It does not drive the user's session.

## The prompt icon is a closed state set — 2026-09-15

The footer walk kept failing on whole classes of screen, and the reason was in the Hermes source,
not in any capture: `cli_tui_mixin.py`'s `_get_tui_prompt_fragments` paints the prompt's LEADING
ICON per state, from a closed set — `⚕` working · `?` clarify · `✎` clarify-freetext · `⚠` approval ·
`🔐` sudo · `🔑` secret · `● ◉ 🎤` voice · a busy-command SPINNER frame (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, `cli.py`
`_COMMAND_SPINNER_FRAMES`, advancing ten times a second) — optionally preceded by a non-default
profile name (`coder ❯`), and optionally followed by `❯` (minimal chrome omits it). The old prompt
regex accepted only `❯` and `[⚕?✎]`, so two whole states rejected their footer wholesale:

- **A busy slash command** (`/compact` → "Compressing context…"): the icon is a spinner frame, the
  placeholder is `{frame} {command status}` in italics. The statusline — wrapped at the pane width,
  with the right-aligned session title on its own row — stayed in the mirror as orphan bars.
- **A sudo/secret password prompt** (`🔑`): same wholesale rejection; the statusline rows and the
  italic instruction (`type password (hidden), Enter to submit · ESC to skip`) stayed behind.

The prompt regex now accepts the closed set (a profile name is a WORD — letters/digits/`_`/`-` — so
an unknown emoji followed by `❯` still reads as unknown and stays visible, which the negatives pin).

**Which placeholders are lifted into the fixed strip is decided per state**, because italic alone
does not tell instruction from suggestion: on the states whose prompt REPLACES the composer with an
instruction (`⚠ 🔐 🔑 ● ◉ 🎤`, spinner) an all-italic placeholder is lifted as the hint row — the
password instruction survives the composer block leaving the mirror. On `⚕` the only lifted
placeholder is the verified working hint (canonical spelling; the join across a physical wrap would
mangle any other text); an UNKNOWN italic there, and every idle `❯` suggestion, keep the composer
visible exactly as before. `?`/`✎` belong to the clarify card. Typed copies are never italic, so a
draft is never lifted. The status walk above the top rule also widened 4 → 6 rows: a wrapped
statusline plus its title row is already three.

## Frames the pane cut in two — 2026-09-14

A response frame is drawn at the width of the terminal that was on screen when the message
COMPLETED, and the pane re-wraps those scrollback rows at whatever width it has now. So a frame
printed in a wider window arrives as its own continuation: `╭─ ⚕ Hermes ───…` on one row and
`───…╮` on the next. Measured on the operator's own pane (`w7:p9`, Herdr 0.9.0, read-only
`recent`): a 160-column pane returning **211-column frames**, every frame on screen split, both
halves of every border present.

Every pattern here is anchored to a whole row, so those borders read as ordinary dashes: the frame
was never fitted and the operator was left with the box's leftovers — a `────╮` floating at the
start of a message and a `────╯` at its end. That is the visible fault, and it is why the fitting
looked unstable: it worked on captures whose frames happened to fit the pane and failed on every
frame drawn before a resize.

The adapter now rejoins a border that reaches its corner, on the row the label was already on, and
fits it — reaching the corner is itself proof this is a frame, so a closing border whose opening has
scrolled off is fitted too, rather than left as a dash band. The rows it was cut over are EMPTIED,
never deleted: source-row indices must keep lining up with the screen (`latest-reply` maps a reply's
last row onto this array before hiding it), and one blank row where the wrap was is the price. A run
of dashes that no border opened — a Markdown rule after a closed nested box — is left exactly where
it is; only a corner-terminated run is claimed.

Fitting it also means UN-MUTING it. `checkMuted` (`lib/ansi.ts`) marks a segment that is nothing but
rule glyphs as decorative TUI chrome, and `mirror-space.ts` repaints those `#a1a1a1` — the right call
for a separator, and the wrong one for a border the skin painted in its accent. The two decisions
compose into the fault the operator reported (2026-09-14): a message whose top border was gold and
whose bottom one was grey, and — on a wrapped frame — a gold line that turned grey halfway along,
because the label row is not all rule glyphs and its continuation is. `fitResponseRule` clears the
flag, which is exactly the context the parser says it cannot have.

`hermes.test.ts` re-cuts the captured fixture at a narrower width to pin all three: the rejoined
border and the spent row, the untouched rule that follows a nested box, and the frame's ink.

## Diff and clarify adaptation — 2026-09-10

Hermes inline unified diffs print a hunk header and white text on a skin-derived change fill
(`agent/display.py`). Read-only inspection of the user's pane confirms Herdr's xterm-256
colors `rgb(135,0,0)` and `rgb(0,95,0)`. The display adapter recognizes painted +/- rows only
inside a hunk, normalizes their base colors to Codex's `rgb(74,34,29)` / `rgb(33,58,43)`, and
uses the existing full-row `surface` renderer. Raw mode bypasses this transformation.
`hermes--diff.txt` uses those captured SGR colors with harmless replacement text.

Clarify was tested in an isolated Herdr pane with the installed HermesCLI's actual renderer
and `_tui_make_clarify_number_handler`, `_clarify_batch_lock` and Enter handlers. A minimal
prompt_toolkit host supplied sample questions and a sample status/composer footer; no model,
real conversation input, approval or file operation was invoked. The checked-in q0, q1,
single and Other fixtures retain the last rendered sample card and footer, omitting earlier
shell output. The Other fixture's host keeps `? ❯`; the real renderer switches to `✎ ❯`, also
covered as a refusal case. These are actual renderer/handler captures, not a full Hermes run.

Verified choreography: digit `2` answers a single question immediately; in a batch it locks
only the current answer and advances to the next unanswered question. The final answer
resolves the batch. The Other digit only opens text entry; typed text plus Enter supplies the
custom answer. Cards therefore send exactly one digit, never an extra Enter. Other returns
to Hermes' terminal panel with the existing phone composer for text. Checkbox and truncated,
unknown or incomplete cards are not lifted because their keys have different semantics.

The shared prompt model has an optional literal `regionSignature`, like the preview model:
card identity includes the full panel/question/choices and mode, excluding changing timers
and status fields; the bridge still binds each write to the freshly read literal panel plus
footer. A stale question or option fails the shared guard. This does not add an ordinary
reply/draft verification claim; `displayOnly` continues to preserve Hermes' one-shot replies.

Earlier display-only notes below describe the capability before this addition.

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
