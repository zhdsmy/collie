# Codex saved-session picker (`/resume`, `codex fork`)

Captured and live-verified on **2026-09-16**, Codex **0.154.0**, in a disposable Herdr
tab. Its `CODEX_HOME` was isolated under a temporary directory, holding a copy of the
state database with every row deleted and four synthetic sessions written back, plus
matching rollout files. No credential was copied, no model request was made, and no real
session or daily configuration was touched.

## Recognition

`codex--v0154-resume-*.txt` are byte-faithful captures through the bridge's fixture
script. The screen is a full-screen view, not a bottom pane: a bold `Resume a previous
session` (or `Fork a previous session`) header, a `Type to search` / `Search: …` row
carrying the `Filter:` / `Status:` / `Sort:` toolbar, the list, a dim progress rule
(` n / m · p% `), and two hint rows the toolbar advertises.

A row is a 4-column inset (`❯ ` selected, `⌄ ` expanded, `  ` plain) followed by a
12-column date cell and the session's preview text. The comfortable density prints the
date and branch on a second line under the title instead. Codex draws the whole screen
itself, so the header must own the top: anything but blank lines above it refuses the
region, and the parse also requires the exact row geometry, a painted (bold) pointer
marker, and `ctrl+o`'s label agreeing with the density the geometry implies.

Only rows the viewport shows become options. A second pointer, an unpainted pointer,
a row expanded with `ctrl+e` (its `Session:` / `Created:` / `Conversation:` block
is not a row grammar), or a footer that is not hint rows refuses the whole screen,
so the mirror keeps rendering what the terminal drew.

The footer's selected position minus the visible pointer index gives the first
visible row's absolute position. IDs combine that position and the native title:
identical/truncated titles remain distinct, and scrolling does not renumber shared
rows. Position and total must agree with the visible rows; loading or narrow
footers without numeric positions fall back to native rendering. Full-region
guards still check every action against the current frame.

## Verified recipes

| Intent | Native keys and result |
| --- | --- |
| Browse | `Up` / `Down` moves the pointer one row; the progress label follows. |
| Open | `Enter` resumes the pointed session and returns to its composer. |
| Leave | `Escape` exits to the composer; while a query is typed it clears the query first. |
| Search | Raw unsubmitted text filters the list; the label becomes `Search: …`. |
| Density | `ctrl+o` toggles dense/comfortable, and the `ctrl+o` hint names the view you are NOT in. |
| Expand | `ctrl+e` opens the selected row's details; `⌄` replaces `❯` while it is open. |

`Down`, `Enter`, `Escape`, raw search text, `ctrl+o` and `ctrl+e` were each driven against
the captured pane and the resulting frame captured. Enter resumed a synthetic session and
returned its composer, and Escape returned to the composer from both an empty and a filled
query.

**A digit is text here, not a choice.** Typing `3` while the picker is open puts `3` in
the search field and moves no pointer, so the card never synthesises a digit — it drives
the arrows the footer advertises, Enter, and the search field only
([ADR 0009](../../../../.adr/0009-a-generic-menu-is-driven-by-the-keys-it-names.md)). The
`tab` toolbar (`←/→` changes the focused control), `ctrl+a` (archive), `ctrl+t`
(transcript) and `ctrl+e` are deliberately not driven: each changes state the card does
not model, and none is needed to resume a session.

## Limits

- Positions identify rows in the current native list, not persistent Codex session
  UUIDs. Never retain these IDs across picker instances or bypass the frame guard.
- Comfortable rows whose meta line Codex wrapped across two terminal rows refuse the
  region; the card returns as soon as the row fits on one line again.
- Relative dates (`4d ago`) are part of the region the bridge binds to. A tick between the
  read and the write refuses that write, which is the intended fail-closed outcome.
- Search text is read as `\S+`, matching the client's own sanitizer. A query typed natively
  with spaces is carried into the search field short, and submitting it is refused rather
  than guessed.

## Source cross-check

Native behavior was checked against `openai/codex` tag `rust-v0.154.0`:
`tui/src/resume_picker.rs` (layout, `selection_marker`, `dense_columns`,
`pack_footer_parts`, `footer_hint_lines`, `render_empty_state_line`) and the
`thread/list` mapping in `row_from_app_server_thread`. Source descriptions are supporting
evidence; the ANSI corpus and the live round trips are the interactive capability gate.

## Duplicate-title regression (2026-09-17)

A real `codex resume` list contained two equal, truncated titles and the old
label-uniqueness check rejected all ten rows. The private frame parses after the
position-based fix; no real session titles or paths are committed. Regression
cases deliberately duplicate titles in existing fixtures and cover pointer moves,
scrolling, inconsistent positions, and selecting the second identical title.

Search changes the native Esc hint (start new/exit → clear search) and hides the
archive hint when there are no results. Only search read-back normalizes those
specific hints; all writes still bind to the full, unmodified current frame.

Live verification used the actual client action runner against the user's General
pane: Down/Up, no-result search, and clearing the query all settled successfully.
In the same pane, a temporary credential-free Codex home with two synthetic,
identically titled sessions verified Down + Enter restored the second session's
unique marker. The temporary Codex process was exited and the original resume
list restored. Chromium/WebKit checks cover Chinese, English and German at
320/390 px; they use synthetic API responses, not a real iPhone PWA.
