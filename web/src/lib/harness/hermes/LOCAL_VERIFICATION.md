# Local upstream-adapter check — 2026-10-19

The installed classic CLI is **0.22.1+7.g279aafb.dirty**, checkout `279aafbde3ce`.
Upstream's 0.22.2 captures remain separate evidence; this check does not certify vanilla 0.22.1,
other skins/locales, the Ink TUI, or a real provider's tool selection.

An owned `collie-canary` Herdr session used the installed Hermes Python environment and an
isolated `HERMES_HOME`. `HERDR_AGENT=hermes` was asserted on the pane before testing. A loopback
OpenAI-compatible endpoint returned scripted tool calls after 500 ms, with no provider inference.
The pane ran the real Hermes CLI; Collie's own `SendProtocol`, readers, `AskBook`, `AskAnswerer`
and multiplexer key gate performed the interactions. The session, scratch home and server were
removed after each run. No existing conversation or service was restarted.

Confirmed at 120 columns:

- Long English and Chinese messages, a real blank paragraph, and a five-line message containing
  two literal `────────────────────` rows reached the agent with a `sent` receipt.
- A Chinese single-choice question lifted the upstream card and hid the composer. `Details` sent
  digit `2`; `Other` sent digit `3`, opened the native typed-answer input, and accepted a Chinese
  answer through the Send Protocol. Each card was deliberately left ticking for 1.4 seconds
  before the bridge answered it; its ask id stayed valid.
- A real dangerous-command approval offered only Allow once and Deny. Deny sent digit `4` and
  resumed the turn. The command was never allowed or executed. No persistent permission changed.

At 50 columns the same Chinese question lifted a card and accepted digit `2` through the bridge
after its timer changed. Hermes had wrapped the row's padding and right border onto the next
physical line; the clarify reader accepts only that specific pair and binds the original rows.
`/model` also submitted, opened its native picker, hid the composer and closed with Ctrl+C.

Three small corrections use existing upstream mechanisms: `paste.settleMs: 150` keeps Enter beyond
Hermes's 50 ms rapid-input window; the bounded interior frame walk and the display reader require
an actual prompt after the top border, so a literal rule remains draft content. The wide closed
frame spans at most eight input rows; the narrow open frame keeps its existing eight-row bound.

Limits retained deliberately: a draft taller than the native eight-row viewport can lose its
prompt and is refused; ghost suggestions may also stop a send. Terminal-only draft replay cannot
recover every wrap/newline seam or blank-row padding, so the exploratory 15-draft sweep is not
claimed as all-green. The actual send protocol was checked separately and keeps exact submission
checks. An instant tool dialog can replace the input before a running/empty-box witness is read;
upstream conservatively reports unknown in that case. It does not resend automatically.

The `hermes--v0221-native-*` fixtures contain only the sanitized native panel and its live tail.
Old `clarify-q0/q1/single` samples stay raw under the adopted upstream grammar. The historical
footer reader and its display-only send assumptions were removed; history/startup/diff formatting
lives in `display.ts` and does not parse keyboard state.
