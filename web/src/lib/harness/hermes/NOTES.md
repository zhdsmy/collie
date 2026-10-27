# Hermes CLI display adaptation — 2026-09-10

## Full-width activity and disappearing status — 2026-10-28

Hermes 0.22.5 `cli_modern_layout.top_rule_fragments` can fill its top border with
`── {braille spinner} {activity}`. It drops the session title and closing dash;
`_fit` truncates overflowing activity with `...`. Requiring a final dash made the
whole composer fail recognition, leaving its native input and status in Mirror.
The existing five-second status hold only delayed that failure.

Display and send readers now accept the native ten-frame spinner prefix without
a closing dash. Equal-width closed frames, immediate prompts, tail checks and
unknown-state refusals remain. Narrow send frames exclude the native status row
(` ☤ model`, with a leading space) from the draft; the flush-left busy prompt
still takes text containing ` · `. The profile remains provisional on 0.22.5.

Source-derived tests cover all ten frames at 50/80/120 columns, ellipsis and exact
fits, preserved replies/drafts, unknown activity and torn footers. The installed
Python renderer independently produced the same missing-dash rows at those widths.
An isolated loopback send through the real CLI and SendProtocol returned `sent`
with `probe, Backspace, Enter`. The full-width busy row was not reached in that
interactive run; its coverage is source-renderer output and replay. Owned test
sessions and the isolated gateway were removed. These checks do not certify the
whole CLI or provider behavior.

## Modern footer and missing replies — 2026-10-22

The reported live Hermes 0.22.4 (`647bc64`) uses modern layout: a titled/activity
top rule, composer, bottom rule, then status (after completions when present).
The classic reader missed this footer and selected the short response separator
above `☤ Hermes` as a narrow input. It removed the reply from Mirror and offered
the same text as a terminal draft. Screen still showed the reply.

The reader now removes the bottom status before locating the composer, accepts
equal-cell-width titled rules, and strips from the earlier of status and input.
A torn wide footer stops the narrow search rather than reaching a response above.
Modal tail binding includes the relocated status; the shared send profile accepts
the same top-rule vocabulary. Guards and send keys are unchanged.

The sanitized live tail is `hermes--v0224-modern-done.txt`. Tests retain the reply,
empty suggestion, real draft, completions, narrow/wide working prompts and torn
footer refusals. A source-derived status relocation checks the existing clarify
binding. Browser replay checks Mirror/Screen at 320/390px with no writes.
This is display/frame evidence, not a new send or whole-version certification.

## Send Protocol input profile — 2026-10-17

The new Send Protocol was enabled for Hermes but had no Hermes input profile. A normal idle
pane therefore read `unknown/no-match`, and the reported 30-character send was refused as
`unconfirmed` before writing any text or key. This is independent of the Codex slash-popup
scrolling repair. The old display adapter can hide chrome but cannot supply a Surface frame.

`surface/profiles/hermes.json` registers the native bordered `❯` composer, optionally prefixed
by a profile name. Suggestions are all italic (SGR 3), including localized and randomly chosen
text; plain copies remain drafts. Native `☤` / `⚕` frames are recognized as running, not idle. Permission, clarify, password,
connection, voice and command-spinner prompts are excluded. Existing Surface and Send Protocol guards
handle draft preservation, exact readback and submission; no second sending path was added.
The two `resume-fragments` fixtures contain replayed history above a live empty composer;
their former `screen` labels are corrected to `idle`, since history does not own the keyboard.

The profile stays provisional and probes every send. Its current range is 0.22.1 only;
this is not a whole-CLI certification. Source inspection of `_get_tui_prompt_fragments`,
`_tui_handle_enter`, `_tui_handle_paste` and the default multiline bindings confirmed the
state markers, Enter, Ctrl+J and native paste marker. Other themes, customized newline keys,
busy-turn interruption, attachments and interactive permission responses were not live-tested.

On Hermes 0.22.1+7.g279aafb, one isolated Herdr session sent Chinese text, an empty line and
an English second paragraph through the real protocol. The receipt was `sent` with
`probe, Backspace, ctrl+j, ctrl+j, Enter`; Hermes returned `CANARY_READY` and the empty
composer returned. No tools were requested. The owned canary was removed, and the user's
existing Hermes session received no input and was not restarted.
Local ANSI, row reads and receipt are in `/private/tmp/collie-hermes-send-KjNLD4/`.
The saved-frame phone screenshot is indexed at
`/private/tmp/collie-hermes-send-evidence/screenshots/index.md`; it proves rendering only.

## Busy composer receipt repair — 2026-10-17

The existing General Hermes session reproduced `unknown/no_evidence` after a successful send:
S2 saw `☤ ❯` while the model ran, but the idle-only frame reader returned null. The earlier
isolated canary replied before the evidence window closed, which concealed this case.
The profile now names the busy prompt explicitly (`idle.runningPrompt`); Surface remains
`running`, ordinary sends into that state still hold/refuse, and S2 confirms the accepted send.
The fixture `hermes--v0221-zh-send-running.txt` keeps only the captured three composer rows.

The repaired protocol sent one diagnostic in the same user-authorized General session with
`probe, Backspace, Enter`, returned `sent` in under one second and received `COLLIE_HERMES_FIXED`.
No session restart or provider configuration change was needed. The native `Model fallback`
warning belongs to Hermes' provider retry and remains visible. Local evidence:
`/private/tmp/collie-live-send-1792252464445/`; failed reproduction:
`/private/tmp/collie-hermes-current-232826/`. This proves idle sending and the busy receipt,
not busy interruption, every slash command, or the whole CLI.

## Python launcher identity and localized history — 2026-10-12

Hermes v0.21.6+4.g5884a65 launches as `python3 -I -c …`. Herdr 0.9.3 did not identify
that foreground process, so Collie correctly received `agent: shell`; all Hermes cards,
response rules and statusline adaptation were disabled together. The session-only Herdr
integration was already current. Its persisted session reference cannot prove a live agent.

Use Herdr's documented `HERDR_AGENT=hermes` hint on the Hermes launch command, scoped to
that process. On this host the user launcher exports it only when `HERDR_ENV=1`.
The operator authorized exiting and resuming the same session; both Herdr and Collie's
live snapshot then reported Hermes, with all 469 stored messages retained. Neither Herdr
nor Headroom was restarted. If a Hermes update rewrites its launchers, recheck the hint
and live identity; changing the launcher cannot affect an already-running process.

The fresh resume also exposed translated Rich history labels. The same complete-frame,
dim-title and role checks now accept English, Simplified Chinese and Traditional Chinese.
Announcement counts, role indentation and tool summaries follow the installed renderer's
`cli.resume` translations. Native prefix length determines continuation indentation; source
row counts and search offsets stay intact. Unknown or incomplete frames remain native.
Startup and fixed status already parsed the new live ANSI after identity was restored.

The Chinese fixture is a sanitized subset of that live resume; Traditional Chinese is a
source-derived substitution. Parser checks cover folds, counts, search offsets, preserved
indentation and refusals; the 320px browser check saves folded/expanded screenshots.
This validates display adaptation, not every translated dialog or a new model turn.

## v0.21.3 emblem and startup counts — 2026-09-17

Read-only inspection of the existing General pane (v0.21.3, `140d1254`) confirmed
two format changes: the response/status/working emblem is now `☤`, and the startup
count row includes `N MCP servers` before `/help`. Both `⚕` and `☤` are recognized
at the same Hermes-only boundaries. Unknown prompt symbols still fail closed.
The startup count accepts the optional MCP quantity; existing detail groups already
retain each server's name and description, so no new card structure is needed.

The live frame now yields startup/history cards, fitted rounded response borders,
and one fixed status row. Full model/effort enrichment also accepts the new emblem.
Regression checks retain older fixtures, cover new idle and wrapped response frames,
synthetic working/draft states and startup counts, and preserve source-row mapping.
No input was sent to the user's Hermes conversation.

## A streaming reply can tear the footer, and the strip now outlives it — 2026-09-19

The operator, watching a reply stream: "有些瞬间 statusline 不见了". Measured instead of guessed: the
pane read was sampled 320 times at ~100 ms while a reply streamed into an isolated Hermes pane, and 2
of those samples came back as a TORN FRAME — every row of the screen except the footer, which the TUI
was mid-repaint on, so the capture's last row was the streaming line itself and no status row, no
prompt and no rules were in it at all:

    197  ┊ 💻 $         for i in $(seq 1 200) + 4 commands  13.3s
    198  ┊ 💻 preparing terminal…        ← the screen's bottom row

`extractStatusLines` is right to report nothing for that capture — there is nothing there — but the
view was treating a missing MEASUREMENT as an instruction to unmount the strip, so the whole chrome
below it moved up and back on the next poll. `hooks/use-held-statuslines.ts` now holds the last rows
that DID carry a strip for up to 5 s, keyed on the pane address plus its agent (so a pane switch
adopts the new screen instead of showing this one's), and never past that window (so a pane whose
agent really stopped painting a footer is corrected rather than left stale). Reasoning and the
boundary — it is deliberately not extended to `hasInputBox`, which gates a destructive write — are in
that file's header.

## Startup and resume announcements share read-only cards — 2026-09-16

The native startup panel has a bold `Hermes Agent v…` heading, a rounded full frame,
`Available Tools`, and the `N tools · M skills · /help for commands` count row. Only a
complete matching frame folds. The standard six-row painted logo and a simple adjacent shell
launch command join it when the command's resume ID matches the panel's Session field.
Unknown branding, cropped frames, earlier session-exit statistics and unframed warnings stay raw.
The expanded banner extracts model/provider, directory, session ID and build into labelled
fields. Toolsets, MCP servers and skills become wrapping single-column groups. The painted
logo, frame, launch command and redundant welcome are omitted; useful notes and update
warnings remain. The right-column boundary comes from the native Tools heading, measured in
terminal cells so a CJK directory cannot shift the split.

`cli_agent_setup_mixin.py` prints the resume announcement with a bold session ID; its prefix
is not always bold. Only a styled, immediately adjacent announcement belongs to the verified
history panel. Up to three Rich-wrapped rows are accepted. The card summary uses the title and
user-message count; the full ID and total count become compact body metadata.

`cli.py` prints the standard Welcome after replay, then startup prewarm warnings and a random
tip. The exact welcome is omitted; the adjacent dim `✦ Tip:` payload joins the startup card.
Intervening warnings or unknown text stop that tail. This is an intentional visual regrouping;
the raw blocks and all their source rows retain native order for latest-reply subtraction.
Semantic values reference offsets in normalized searchable lines. Removed decoration becomes
blank rows; retained text keeps the original row count and ordering. `AnsiOutput` uses those
offsets for find/link rendering before nesting the tail under its card. Decorative text is
excluded from find; the history ID/count metadata is display-only.
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

The card starts collapsed and scrolls internally when expanded. It separates native user,
Hermes, event and tool-activity entries, removes role-label continuation padding, and preserves
real blank lines. Hermes bodies use the existing Markdown renderer; user/event/tool content
stays literal. During find, bodies use plain highlighted text to retain exact match offsets.
It does not try to reverse arbitrary terminal hard wrapping.
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

The model field expands to the full name from the exact Herdr-reported session in Hermes'
read-only SessionDB, only when it matches the terminal's full name or truncated prefix.
Do not append the saved `model_config.reasoning_config` effort: `/reasoning` can change
the running CLI's in-memory setting without updating that database field, leaving the
strip stuck on an old level. Saved metadata and global config are not live reasoning
state. Credentials and other sessions are never used to fill gaps.

Historical verification (before removing saved effort): 5,906 frontend tests and 208 targeted
backend tests pass, alongside both typechecks, the root build and full-tree lint.
Chromium checks at 320/390 CSS pixels, light/dark and English/Chinese
keep both curved ends visible on one row, retain full model plus effort, and scroll through the
last status field without widening the document. Browser checks also retain a multiline real draft
and restore terminal-width frames in Raw terminal mode. Direct read-only checks resolve the active
Hermes session and its saved full model/high effort. No live send, agent restart or iPhone PWA
interaction is claimed.

## Working footer — 2026-09-10

### Localized working hint — 2026-10-12

Hermes v0.21.6+4.g5884a65 translates `cli.tui.placeholder_busy`: English `msg=interrupt`,
Simplified Chinese `发消息=中断`, Traditional Chinese `訊息=中斷`, with the shared `/queue · /bg · /steer`
commands and localized cancel label. The exact English-only comparison left the Chinese input
frame in the mirror. Accept those three complete official strings and restore the matching
language's spacing after physical wrapping. Keep the all-italic placeholder, matching rules,
statusline and tail checks; typed copies, partial translations and unknown hints stay visible.

`hermes--v0216-zh-working.txt` is reconstructed from the existing sanitized working fixture and
official translation, corroborated by the operator's screenshot. The live session was idle when
read; no model call or session restart was made to recreate working state. The existing browser
spec now replays Chinese hints too, explicitly selects Terminal view, and saves settled screenshots.

### Original capture

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
