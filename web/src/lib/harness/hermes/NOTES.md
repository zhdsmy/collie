# Hermes CLI display adaptation — 2026-09-10

The source was Hermes CLI v0.21.1 (2026.9.7), upstream `145c713f`, running in Herdr 0.9.0.
An existing completed pane was read with `recent-unwrapped`, ANSI format, without sending input.

`hermes--done.txt` retains the captured ANSI response borders, status fields, prompt suggestion
and composer rules. Its two body paragraphs, model name and session title were replaced with
generic text; it is a sanitized structural fixture, not an unmodified conversation capture.

The official `hermes_cli/cli_stream_mixin.py` prints `╭─ ⚕ Hermes … ╮` (optional timestamp)
and a same-width `╰─…╯`. Only this identified pair is simplified; unmatched borders, tables,
Markdown rules, nested boxes and differently branded skins remain raw. Row counts before the
footer are preserved for the latest-reply view's source-row mapping. No prose reflow is attempted.

`hermes_cli/cli_status_bar_mixin.py` paints a medical-symbol/model status row, pipe-separated
context and other metrics, optional right-aligned title, then the ruled prompt-toolkit composer.
The context percentage is **used**; `◎` is cache-hit percentage, not context. Status ANSI colors
are retained without the full-width background. Inverse title ink is restored to the title accent.
Unknown status fields are preserved. No hard-coded terminal width or exact RGB theme is required.

The footer must be complete and tail-anchored, with equal-width rules, the Hermes status signature
and `❯` prompt. Only an empty/italic-suggestion input is hidden; real drafts remain visible.
Menus, torn screens and customized status bars that lack identifying fields retain raw input.

This adapter is **display-only**. `sendGuardedReply` explicitly preserves Hermes' existing
one-shot transport. No composer-ready claim, draft takeover or interactive dialog is enabled;
those require a separately verified input contract. Unit tests pin the unchanged transport and
run the conformance suite against the other harness captures. Browser checks use mocked APIs.

Verification: 5,904 frontend tests pass, alongside both typechecks, the root build and full-tree
lint. The real local Collie pane API yields one status row and no empty composer. Chromium checks
at 320/390 CSS pixels, light/dark and English/Chinese keep the strip at 14px, scroll through its
last field and leave document width unchanged. Browser checks also retain a multiline real draft
and restore the original frame in Raw terminal mode. No live send, agent restart or iPhone PWA
interaction is claimed for this display-only change.
