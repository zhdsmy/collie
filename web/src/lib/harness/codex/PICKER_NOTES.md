# Codex model and statusline pickers

Captured and live-verified on **2026-09-13**, Codex **0.154.0**, in a disposable Herdr
tab. Its Codex configuration and working directory were isolated under a temporary
directory, with a local unavailable test provider. No model request was made and no
daily-session model or statusline configuration was modified.

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
