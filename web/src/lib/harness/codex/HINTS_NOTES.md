# Codex operation hints (display only)

The existing `codex--working.txt` capture prints `• Working (3s • esc to interrupt)`
immediately above the live composer. Read-only verification on 2026-09-10 with Codex
0.153.4 shows the same shape, with a minutes-and-seconds duration and a configured statusline.
`codex--queue-context-inline.txt` captures the queue hint and context metric sharing a footer.
The already-supported split queue/context footer is covered by a derived unit case.

Only the nearest nonblank row above a located live composer can supply the interrupt hint;
the existing two-blank-row section bound applies. Match the whole captured working indicator,
then slice by joined text offsets to retain ANSI paint. Remove only the separator and hint
from the transcript, preserving `Working`, the duration and closing parenthesis. Historical
indicators followed by output, quoted lines, unknown shapes and frames without a composer stay
in the mirror. Raw terminal mode bypasses this display lift as it does other adapter chrome.

Queue hints come only from the validated footer, never from a draft paragraph. An inline
footer is split into its original context text and actual queue key/wording; the supported
two-row footer retains its context row and moves the queue row below it. If both operation
hints exist, join them in one optional row. No hint text means no extra row. There is no cached
working state, no inferred Enter/Tab hint and no new key action. Codex's bottom strip reads the
latest pane frame even while the operator scrolls through a frozen transcript, so completed
work cannot leave stale operation hints. Approval/question controls
stay with their existing dialogs; composer recognition, draft extraction and send bindings
are unchanged. Unsupported hint layouts remain at their existing locations.
