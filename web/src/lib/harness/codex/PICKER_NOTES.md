# Codex model and statusline pickers

## Agent chooser (2026-09-28)

Codex 0.158.0's daemon `Agent command center` is lifted through the existing
single picker. The `codex--v0158-agents-overview*.txt` files are byte-preserved
ANSI captures from an isolated canary and app-server, using synthetic tasks and
an unavailable local fixture provider. The bold title, Project grouping,
filters, table columns, painted pointer and exact default navigation footer
must agree. The current task and the pointed row are separate.

Up/Down moves the native pointer, Enter opens once, and Escape cancels. Names
and project paths identify visible rows; the terminal exposes no UUID column.
Duplicate visible identities, partial frames, other grouping modes and search,
rename or management dialogs remain native. Updated ages and the changing
right-hand preview are excluded from row facts but remain in the bound region.

The active command center may follow terminal scrollback in inline mode. Its
last header and complete tail own the picker; preceding transcript stays raw.
Read-only sampling against the local 0.158.0 daemon on 2026-09-29 reproduced
this prefix in `codex agents --no-alt-screen`. Output after the footer still
invalidates the card. The 320px browser test includes a synthetic prefix.

The list shows at most five fixed-height rows in its own scroll area, shrinking
with the dock on short screens; pointer movement keeps the focused row visible.
Delete operates on the pointed task. It opens `?`, reads the native Tasks/Delete
shortcut, returns to and revalidates the same row, then opens the confirmation.
Codex 0.158.0 defaults this shortcut to Backspace (`keymap.rs`); on this macOS
TUI help prints `delete`. The exact permanent-delete warning and both choices
are lifted as a single picker. Cancel is initially focused, and deletion needs
a separate user choice.
The six-row/help/delete captures use an isolated home/app-server and synthetic
tasks. Live client/bridge verification opened the confirmation with bound keys
`?`, Escape, Backspace, then explicitly deleted only a fixture task and observed
the native list shrink from six to five on 2026-09-29. This action also deletes
child-agent history and stops running work; native warnings remain visible.

The native view was opened with `/agents` in the isolated remote TUI. The
0.158.0 `app/input.rs` Left handler routes to the same `open_agents_overview()`
when the composer is empty and viewing an external writer on a shared daemon.
The standalone fixture app-server does not reproduce that writer state.
The actual `submitPickerIntent` and bridge `keysPane` verified Up/Down + Enter
opening both tasks and Escape cancellation, with prompt binding on every write.

Captured and live-verified on **2026-09-13**, Codex **0.154.0**, in a disposable Herdr
tab. Its Codex configuration and working directory were isolated under a temporary
directory, with a local unavailable test provider. No model request was made and no
daily-session model or statusline configuration was modified.

## Resumed-session mode controls (2026-09-17)

Codex 0.154.0 queues `SessionStart` for resumed sessions and runs it only when a
model turn begins (`core/src/session/session.rs`, `session/turn.rs`, and
`hook_runtime.rs` at tag `rust-v0.154.0`). An idle resumed pane can therefore have
no reported session ID even with the current Herdr integration installed.

Plan/Fast controls allow that absence while retaining idle, empty-composer,
capability, and exact native-prompt guards. Compare the session identity strictly:
`undefined` becoming a real key invalidates an in-flight action too. Recent-model
history still requires a real session key; never derive one from a pane or cwd.

Native verification used a disposable Codex pane, hooks disabled, and an
unavailable local provider. Plan ON/OFF via guarded Shift+Tab and Fast ON/OFF via
guarded `/fast` each succeeded with no session ID and an empty composer afterward.
Fast requires a model catalog entry exposing the Fast service tier; a fallback
model can display `Fast off` while `/fast` is unavailable. Test with real model
metadata, without copying authentication or changing the user's configuration.

## Scope (2026-10-02)

Model/reasoning, statusline configuration, saved-session and agent pickers, and command
approvals and folder trust are cardified. Since 2026-10-08 the question card (with question
navigation and notes), the Plan decisions and the `/review` pickers are cards again, restored on
Codex 0.160.1 (ASK_NOTES.md, PLAN_NOTES.md, REVIEW_NOTES.md). Asynchronous questions stay in the
native terminal view; Collie does not expand or answer them.

Folder trust uses
the upstream card for the captured `Folder access` layout; unknown layouts remain native.
Composer recognition and prompt binding still protect ordinary chat sends when
a native dialog owns the input. Retain the native captures as regression cases.

## Recognition

`codex--v0154-picker-*.txt` are byte-faithful captures through the bridge's fixture
script. The model stages use bold titles and one bold cyan pointer row, numbered
options, optional descriptions and the dim tail hint `Press enter to confirm or esc
to go back`. Titles distinguish model, reasoning, advanced reasoning and reasoning
scope. The `(current)` suffix identifies the saved value; the pointer is separate.
The advanced picker retains the usage-limit warning.

The statusline stage has a bold `Configure Status Line` title, a dim `Type to search`
label, an indented `>` query, `[x]`/`[ ]` rows, a preview and the exact dim footer
`Press space to toggle; ←/→ to move; enter to confirm and close; esc to close`.
An unsuccessful nonempty query prints dim `no matches`; it still supports search,
save and cancel. Only visible rows are modeled; scrollback cannot recover hidden
options. Labels and descriptions come from the terminal, not a bundled catalogue.

When every status item is disabled, Codex omits the preview row entirely. The
`codex--v0154-statusline-*.txt` companion captures cover the composer after saving
disabled, single-item and muted multi-item configurations in default and Plan
modes. These are input-compatibility fixtures: a custom footer must not prevent
the next command, and a menu's selected arrow must never qualify as a composer.

Codex 0.158.0 retains the model and statusline titles but shortens their footers
to `enter select · esc back` and `space toggle · ←/→ reorder · enter save · esc
cancel`. Footer keys are bold and the action text is dim. A pointed row bolds its
label; its description may be inverse-highlighted without being bold. Its empty
statusline search keeps a blank row after `Type to search` but omits the `>` input
row. The captured statusline view places a `↓` marker immediately before the
preview and omits the blank gap before its footer. Model names still come from the
visible rows. The reasoning page uses `enter default · s session · esc back`;
Enter applies the default and `s` applies only to the current session. The existing
card confirmation uses Enter. Recent-model selection matches exact spelling first,
then accepts a unique case-folded match for versioned GPT IDs; custom IDs stay exact.

## Verified recipes

| Intent | Native keys and result |
| --- | --- |
| Choose a model or reasoning level | Walk Up/Down, verify the intended row, then Enter once. A child picker may open or the setting may apply immediately. |
| Advanced reasoning | Select `More reasoning…`; the next stage offers Max/Ultra and preserves its higher-usage warning. |
| Plan reasoning scope | Changing effort for the **same model** in Plan mode opens `Apply reasoning change`; choose Plan-only or global-plus-Plan explicitly. Changing models can apply without this stage. |
| Toggle a status item | Walk to the row, verify it, send **`Space`**, then verify its checkbox. A literal blank key is rejected by Herdr. |
| Reorder | With no search, Left moves one position up and Right one down. The theme row is fixed and cannot be crossed. |
| Search | Raw unsubmitted text filters the native list; Backspace removes query characters. Enter saves, so applying a browser search never sends Enter. Space toggles and must not be forwarded as query text. |
| Browse | One Up/Down at a time; read the new visible window and validate all overlapping rows. |
| Save/cancel | Enter saves the staged list and theme preference; Escape closes without saving. Neither key is blindly retried. |

The checkout's actual `submitPickerIntent` and API/guard modules were run against
the disposable pane, including model → reasoning → scope, statusline toggle/reorder,
search/no-results/clear and cancellation. Comparisons use the actual screen region
for the bridge's prompt binding. A missing or changed picker stops the remaining
keystrokes; this is not an unguarded key macro.

## Source cross-check

The native behavior was also checked against `openai/codex` tag `rust-v0.154.0`:
`tui/src/chatwidget/model_popups.rs`, `bottom_pane/list_selection_view.rs`,
`bottom_pane/multi_select_picker.rs` and `bottom_pane/status_line_setup.rs` under
`codex-rs/`. Source descriptions are supporting evidence; the ANSI corpus and live
client round trips are the interactive capability gate.
