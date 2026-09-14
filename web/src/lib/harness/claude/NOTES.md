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
