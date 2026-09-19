# Claude Code statusline adaptation — the mode field — 2026-09-14

Claude Code prints its permission mode under the input box, on the statusline run the app already
re-surfaces (`chrome.ts`'s `extractStatusLines`, matched by POSITION, never by content). Every shape
seen in the wild or in the fixture corpus:

```
  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← 1 agent      claude--draft-footer-single.txt
  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents   claude--working.txt (working)
  ⏸ manual mode on                                              claude--draft-wrapped.txt
  ⏸ manual mode on · ← 4 agents                                 claude--menu-model-picker-dismissed.txt
  ⏵⏵ auto mode on (shift+tab to cycle) · esc to interrupt · ← for agents   live pane, 2026-09-14
```

Facts, and what they pin:

- **The mode is `<⏵⏵|⏸> <name> on`**, and the `(shift+tab to cycle)` parenthetical is a HINT, not
  part of the mode. The `⏸` forms print no hint at all — a detector keyed on the hint text would
  miss half the corpus, which is why `mode.ts` matches the `<glyph> <name> on` spine and splits the
  hint off separately.
- **Colour is split across the row**: the mode run is painted (pink `255;107;128` on the captures)
  and the hint that follows is grey. Splitting the hint must preserve the mode's own paint — the
  renderer draws the two keys in its place, so the mode text is all that survives of that half.
- **A working Claude keeps painting the row** (`esc to interrupt` joins it as another field). Unlike
  the Codex mode toggles — whose footer stops naming the mode while working, so the app can gate on
  idle — there is nothing to read here that distinguishes "will queue" from "will swallow", so the
  app does NOT gate on status. It sends the key and reports what it can prove.
- **What a tap does is Claude's business.** The app sends one `shift+tab` and then reads back whether
  the mode TEXT changed. The cycle ORDER is deliberately unknown and unrecorded; an
  `unconfirmed` result is the honest outcome of a swallowed key.
- **`shift+tab` while a dialog is open is unprobed and provably dangerous**: the permission dialog's
  own answer row reads `2. Yes, allow all edits during this session (shift+tab)`
  (`claude--permission-edit.txt`). A keyboard-owning block therefore refuses this control outright
  (`readClaudeModeState` returns null), the same gate every other adapter write runs through
  (`harness/dialog-contract.ts`).
- **The write is bound to `composerRegion`** (`chrome.ts`): the input box's top border through the
  buffer's last non-blank row — NOT through the mode row. The bridge accepts a match that ends within
  its last six non-blank rows (`bridge/prompt-binding.ts`), and the background-agents footer below the
  mode row can be taller than that, so a shorter binding would refuse every write on a busy pane with
  `prompt_changed` for no reason the write caused.

Where each half lives: detection in `harness/claude/mode.ts` (pure, fixture-pinned), the guarded send
in `lib/claude-mode-switch.ts` (the Codex toggle's choreography, one key instead of a command), the
button in `components/statusline-row.tsx` (icons borrowed from the composer keyboard's own Shift and
Tab). This file is the record of WHY; the tests pin the shapes.
Upstream 1.10.1 locates the composer by its frame and rejects modal key hints. Keep the
native working segment `esc to interrupt` exempt only inside the confirmed statusline
run, never an unknown tail or the background-agent footer. Other hints on that same
row still block typing. The shared menu-key parser stays unchanged, so the exception
cannot leak to other agents. Frame, send and mode-switch tests cover this boundary.

# Tabbed Settings stay native — 2026-09-16

Claude Code 2.1.273's Status/Config/Usage/Stats tabs are not generic pickers. The generic detector
only understands footer keys: Config's search-box border becomes a false region boundary, while
Stats' tab labels become a false title. Single-hint Status/Usage pages already stay raw.

`menu.ts` declines the active Settings tab heading and the distinctive Config/Stats footer hints,
including scrolled views without the heading. Keep this exclusion in Claude's detector, not in
shared `MenuBlock`, `PromptPanel`, or key-hint parsing. `composerReady: hasInputBox` still protects
normal replies; operators use direct keys for native tab navigation. Earlier Settings scrollback
must not suppress a later `/model` picker. `fixtures/claude-settings.ts` contains explicitly
synthetic, screenshot-derived structural regressions; it is not a live capture corpus.

# Configured statusline fields — 2026-09-17

The local command prints `model effort | ctx N% | branch | vVERSION`, where `ctx` comes from
`context_window.remaining_percentage`. Claude Code 2.1.273 may append a right-aligned native
`new task? /clear to save … tokens` hint; the mode/agent hint occupies the next row. The sanitized
`claude--custom-statusline.txt` preserves the captured input/footer ANSI and padding, replacing the
session label, model and token count; preceding conversation content is omitted.

Existing positional extraction already finds both rows. Only Claude pipe-separated display rows
get compact fields; the shared context ring takes `remaining=true`. Preserve unknown fields and
native hints, replacing terminal-width padding with app gaps. Keep the existing mode control and
send gates unchanged. A first sample omitted the lower rule during repaint; a repeat capture had
the complete box. Do not loosen composer recognition to accommodate a torn display frame.

`scripts/claude-statusline.sh` reads `fast_mode` directly and emits `Fast:on/off`; extended thinking
is independent. The formatter exposes `prompt_cache.warm` plus the 0–1 `hit_ratio` as a percentage,
distinguishes unreported caching, and omits absent values. The local settings command points to the
installed script. Configuration changes require a backup and live output read-back, not a session
restart. Missing/invalid `ctx` values get no fabricated ring.

The known `new task? /clear to save … tokens` hint lives behind a read-only Info button. Its anchored
popup is portalled out of both status scrollers and the mirror filter so it cannot be clipped or
double-inverted. Unknown hints stay literal. The mode row drops its terminal indent only in the
display; detection, region binding and the existing shift+tab recipe keep the captured text.

# 2.1.278 paints hints and notifications on the statusline and its own rows — 2026-09-19

Claude Code 2.1.278 puts two new kinds of text under the statusline, and both were read as something
they are not. Reproduced in an isolated scratch pane; every capture is synthetic-content, real-ANSI.

- **`ctrl+g to edit in Vim` rides the STATUSLINE row while a multi-line draft is in the box**
  (`claude--draft-multiline-vim-hint.txt`). `classifyFooter`'s plan family matched the phrase
  ANYWHERE in a row (it is the ExitPlanMode footer), so the statusline row — the user's own
  `model | effort | …` plus the hint appended — refused the whole box in `locateInputBox` step 4.
  `hasInputBox`/`composerReady` then answered false, the guard's verify-after read found no draft,
  and every multi-line reply stalled as "text delivered, not submitted" (the user then had to press
  Enter by hand in the pane). Fix: the plan family requires the phrase to OPEN the row, which every
  real footer in the corpus does (` ctrl+g to edit in Vim · ~/.claude/plans/…`). The plan-path
  alternative stays unanchored — a narrow pane wraps the footer after the `·`.
- **Notifications are painted right-aligned on their OWN row, below the mode row** (2.1.278 moved them
  out of the statusline row, which is where 2.1.273 put them — see `claude--custom-statusline.txt`).
  The known `new task? /clear to save N tokens` sentence therefore arrived on a row without any ` | `
  field, fell through `StatuslineRow`'s router to the verbatim branch, and the phone showed the hint
  as a raw, right-indent-padded strip row.
- **The hint is a TIP, and a tip belongs on the actions belt, not in the terminal strip** (operator's
  call, 2026-09-19 — "以 tip icon 的形式放在操作提示栏"). The strip is fields: compact values the pane
  is saying about itself, each one wearing an icon. Claude's sentence is a suggestion with a command in
  it, so it went behind an icon-only pill at the end of Collie's run on the belt (`composer.tsx`), which
  opens the shared in-flow dock with the sentence verbatim. `claudeHintText` (chrome.ts) is the ONE
  reader of that sentence; `StatuslineRow` drops the field it finds so the strip never prints it twice.
  The tip appears and disappears with the pane's own screen, and the pill is absent everywhere else.
- **A notification row is an ASIDE, and a whole row of it is one** (`isClaudeAsideRow`, chrome.ts). The
  rule is structural: a statusline-tail row that starts past column 8 and carries no ` | ` field, or the
  `new task?` sentence at any indent (a narrow pane can right-align it into nothing). Its two jobs are
  the tip pill and the box: `claudeHintText` reads the tip text off it, `StatuslineRow` returns null for
  it, and `tailNamesAMenu` refuses nothing for it. That last one is not cosmetic — a hint-shaped aside
  (`Ctrl+Y to paste deleted text`, 47 columns in on a 77-column pane) reads as `<key> to <verb>`, so the
  box used to be refused outright while it was up: empty strip, greyed composer, `hasInputBox` false.
  `claude--notification-paste-delete.txt` pins all three, and the corpus invariant in
  `input-box-frame.test.ts` now counts the aside it exempts instead of asserting it cannot exist.
- **Ceiling, accepted:** a user statusline whose own command right-aligns a row past column 8 with no
  pipes reads as an aside — it leaves the strip for the tip icon. One tap, nothing lost, unseen in
  practice. And an aside is shown as Claude wrote it: the app never synthesises or translates a tip.

