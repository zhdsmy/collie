# 0022 — direct input owns the phone keyboard accessory

Status: **Accepted** (2026-08-22)

## Context

Collie split terminal keystrokes across two controls: **Type** streamed phone-keyboard text, while
**Keys** opened a tall dock for navigation, modifiers, digits, function keys, and preset chords. A
terminal interaction routinely needed both surfaces, but opening one displaced or closed the other.
The staged key queue also made modifiers behave unlike a physical keyboard, and the digit pad
duplicated the phone keyboard.

The replacement was explicitly narrowed to two one-line key rails: modifiers plus navigation, and
F1–F12. Adding presets as an unasked third rail would restore the surface sprawl this change removes.

## Decision

**The named Type action arms both direct terminal input and its keyboard accessory. There is no
independent Keys dock or staged key queue.**

The accessory has exactly two horizontally scrolling, non-wrapping rows behind one fixed switch:

- navigation: Ctrl, Esc, Tab, Up, Down, Left, Right, Enter, Shift, Alt;
- function: F1 through F12.

Modifiers cycle off → one-shot → locked. They compose in Ctrl, Alt, Shift order regardless of tap
order, survive switching rows, and apply equally to phone-keyboard characters and accessory keys.
The row switch never sends a key or consumes a modifier. One-shot modifiers clear after the next
composable key; locked modifiers remain until explicitly cleared.

All accessory and phone-keyboard keys enter the same ordered sender. The whole accessory state is
bound to the direct-input session and resets when that session stops, changes pane, backgrounds,
locks, or loses a send.

## Consequences

- Digits come from the phone keyboard. Preset/macro rows from `keys.toml` no longer have a Collie UI.
- Chords send immediately, like a physical keyboard; there is no review-and-Send stage or discard
  confirmation.
- The accessory stays one physical row high. Its fixed switch remains reachable while the key rail
  scrolls horizontally.
- Reintroducing presets or another key group requires a new explicit interaction decision; it must
  not silently grow this two-row accessory.
