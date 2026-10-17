# Codex Resume and Fork

Resume and Fork share the local saved-session reader in `resume.ts` and the searchable,
tappable session list in `PickerBlock`. A tap walks the native pointer, reads the selected
row back, then sends Enter once. Search writes unsubmitted text; it never presses Enter.
The card keeps the current row visible and offers the existing scrollable list and browse controls.

## Restored on 2026-10-17

v1.22.0+collie.1 had adopted the upstream shared menu by operator choice. That menu preserves
the terminal body and offers Up/Down, Resume and Exit; it does not parse tappable session rows
or offer search. Its reader requires `esc exit`, so the shell's `esc start new` / narrow `esc new`
and the search's `esc clear search` do not qualify. It is still used by Muse.

After the operator reported the regression, Codex alone returned to the previous list.
Reuse the retained Fork reader, including its full-screen, painted-marker, row-position and
incomplete-frame checks; do not carry a second copy. Current `⌃` control-key labels are accepted
by density and search-footer checks alongside `ctrl+`.

`codex--v0163-resume-shell.txt` and `codex--v0163-resume-shell-moved.txt` were captured from
Codex 0.163.0 in an isolated canary on 2026-10-17. The upstream reader returned no menu; the
local reader found all nine sessions and followed one native Down. Every title was replaced
with `Saved session NN`, preserving its cell width and ANSI runs. No session was resumed;
the isolated session was removed. A separate 80-column PTY showed the shortened `esc new`.

The existing 0.159 and 0.162.1 captures cover in-session Resume and active search. Saved captures
are replay evidence, not certification of the whole installed CLI. The 320px Chromium/WebKit
E2E uses the current sanitized captures and stubbed APIs to test a direct row tap's Down/Enter
sequence and cancellation. Parser/action tests cover search, empty results and stale frames.

Fork accepts its shorter toolbar only with the Fork title. In a shell picker, Escape starts a
new conversation; the isolated probe uses Ctrl+C to quit instead. Expanded rows, incomplete
frames, unpainted pointers and unknown layouts stay native. The Send Protocol remains unchanged.

Validation for this restoration: affected Codex/Muse parsers, picker actions, components and
Surface folding pass (6,206 tests, with 11 existing todo cases); a temporary
test-edit typo was fixed and the 38 picker actions rerun successfully. The adaptation catalog's
64 replays and four 320px Chromium/WebKit interactions pass. Root and web typechecks and lint pass.
Screenshots are local evidence at `/private/tmp/collie-resume-e2e/`; no model request was made.
