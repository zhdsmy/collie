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
