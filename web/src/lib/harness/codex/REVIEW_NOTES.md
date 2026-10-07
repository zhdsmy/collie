# Codex review picker

Captured 2026-09-14 from Codex CLI 0.154.0 in the disposable Herdr workspace
`collie-review-card-probe` (`wA:p1`). The probe used
`/private/tmp/collie-codex-review-probe`, with no user pane or service restart.

## Native screens

`/review` first opens `Select a review preset` with four numbered choices:

- `Review against a base branch (PR Style)`
- `Review uncommitted changes`
- `Review a commit`
- `Custom review instructions`

Choosing the first option opens `Select a base branch`, with branch rows and a
`Type to search branches` native input. Choosing the third opens `Select a
commit to review`, with commit rows and a `Type to search commits` input.

The first three screens are represented by the existing single-choice Picker
card and use the existing guarded `Down`/`Up` plus `Enter` choreography. The
fourth choice is intentionally only a native row: it enters a free-text editor
that this detector does not claim, so Collie falls back to the raw terminal.

## Verified keys

The preset pointer moved from row 1 to row 2 after one `Down`. `Enter` opened
the base-branch submenu. `Escape` left the picker without starting a review.
The commit submenu was captured before its `Enter` action; no review request
was sent from the probe.

Fixtures are raw `pane.read` ANSI captures: `codex--review-scope.txt`,
`codex--review-base-branch.txt`, and `codex--review-commit.txt`.

## Codex 0.160.1 — restored 2026-10-08

Retired on 2026-09-17, restored at the operator's request. Rows and titles are unchanged. The
footer is now `enter select · esc back` (bold keys, dim words), the pointed row is a selection fill
with a bold label, and the base-branch list shows plain branch names under a dim
`Current branch: X` row (0.154 printed `current -> branch`). The detector takes either footer
and reads the pointer by its bold label.

Verified live on 2026-10-08 in an isolated canary Herdr session, through the checkout's real
`submitPickerIntent` and the bridge's `keysPane`, prompt binding on:

| Card action | Keys sent | Native result |
| --- | --- | --- |
| Review against a base branch | `Enter` | Base-branch picker |
| Browse down | `Down` | Pointer on `feature` |
| Cancel on a submenu | `Escape` | Back to the preset list, which the action counts as done |
| Review a commit | `Down`, `Down`, `Enter` | Commit picker |
| Cancel on the preset list | `Escape` | Picker closed, no review started |

**Review uncommitted changes starts a review on Enter**, with no further screen: a probe walk that
matched the wrong row started one, and Esc interrupted it. The card sends it only on an explicit
tap of that row.

Captures: `codex--v0160-review-preset.txt` (unfilled), `codex--v0160-review-base-branch.txt`,
`codex--v0160-review-commit.txt`.
