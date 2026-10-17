# Codex Resume and Fork

Since v1.22.0+collie.1, Resume uses the upstream shared session menu, by operator choice.
The native list stays inside the card; the footer's Up/Down, Resume and Exit controls send
bound keys through `menu-action.ts`. The local searchable, synthesized Resume list is removed.
The captured `codex--resume-picker*.txt` and `codex--v0162-resume-search.txt` cover the reader;
`web/e2e/codex-resume.spec.ts` checks navigation, confirmation, exit and 320px rendering.

Fork remains a separate local card in `fork.ts`, using the captured 0.158.0 Fork screen.
It accepts the shorter toolbar only with the Fork title. The card offers native Up/Down,
Enter and unsubmitted search, with full-screen binding. In a shell picker, Escape starts a
new conversation; the isolated canary uses the advertised Ctrl+C to quit instead.
Expanded rows, incomplete frames, unpainted pointers and unknown layouts stay native.
Saved captures are replay evidence, not certification of an installed CLI version.
