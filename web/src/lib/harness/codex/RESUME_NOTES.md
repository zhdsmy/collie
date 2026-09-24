# Codex saved-session picker (`codex resume`, `/resume`, `codex fork`)

The Codex 0.156.1 screen puts the filter/status/sort toolbar above its search row and paints
the selected row with `›`. The shell command advertises `esc start new`; in a conversation it
advertises `esc exit`. The sanitized screen in `web/src/test/codex-resume-frame.ts` covers both.

The card offers native Up/Down browsing, Enter, and unsubmitted search text. It binds every
action to the current full screen. Numeric progress gives each visible row a stable positional
ID, including rows with identical or truncated titles. Expanded rows, incomplete frames,
unpainted pointers, and unknown layouts remain in the terminal mirror. The toolbar, archive,
preview, and density shortcuts stay native.
