# Codex plan cards — verified 2026-09-13, restored on 0.160.1 on 2026-10-08

## Codex 0.160.1 — restored 2026-10-08

Retired on 2026-09-17, restored at the operator's request. The three labels are unchanged; the
rest moved:

| Change since 0.154 | What the detector reads now |
| --- | --- |
| Footer `Press enter to confirm or esc to go back` became `enter select · esc back` (bold keys, dim words) | Either footer, every segment bold or dim |
| Descriptions lost their periods; the second is `Start a fresh thread (current context: N% used)` | Both wordings |
| The pointed row is a selection fill, with only the label bold | The first segment is bold (`pointedRow`) |
| `Worked for 11s • 05:47` is a plain dim row, not a rule | Either form, skipped above the menu |
| Herdr's panes report no terminal background, so the plan has no fill | Unfilled, the body runs up to its bold `• Proposed Plan` heading, which must be on screen |

Verified live on 2026-10-08 in an isolated canary Herdr session, through the checkout's real
`submitPickerIntent` and the bridge's `keysPane`, prompt binding on: **No, stay in Plan mode**
sent `Down`, `Down`, `Enter` and left Plan mode on; **Yes, implement this plan** sent `Enter` and
Codex implemented the plan. The session log still stores the plan as one assistant message
wrapped in `<proposed_plan>`, and the bridge's journal reader plus `completePlanText` recovered
its Markdown (code spans included) from that live session.

The card now lives in the height-capped dock (.adr/0059), so the plan and its recap scroll as one
region and the decisions never shrink: they stay on screen at 320 px (`codex-plan.spec.ts` checks
the tap lands on the button). The 0.160.1 recap is an italic `↳ Recap:` row, which the detector
does not read; a resumed plan with one stays native with the unread-dialog card.

Captures: `codex--v0160-plan-prompt.txt` (unfilled), `codex--v0160-plan-pointer-third.txt`.

## Native evidence

The `codex--v0154-plan-*.txt` fixtures come from installed Codex 0.154.0 in a disposable Herdr
pane with a separate temporary configuration and deterministic local Responses provider. The
provider supplied proposed-plan Markdown; Codex rendered the plan and handled every key. No
external model or daily credentials were used. `fixtures/codex-plan-transcript.json` contains
the matching short and long messages parsed from that test session through the real journal
adapter, including the original `<proposed_plan>` delimiters.

Source cross-check: official `openai/codex` tag `rust-v0.154.0`:

- `codex-rs/tui/src/chatwidget/plan_implementation.rs`
- `codex-rs/tui/src/bottom_pane/list_selection_view.rs`
- `codex-rs/tui/src/history_cell/plans.rs`

The observed menu has exactly three decisions. Its fresh-context description is
`Fresh thread with this plan.` on this installed build; the source also documents the older
`Fresh thread.` / `Fresh thread. Context: … used.` wording. Disabled prerequisites add a
different description, so the parser refuses that menu rather than offering an active choice.

## Verified client choreography

The checkout's actual `submitPickerIntent` and API modules were exercised against the test
pane, with the ordinary bridge prompt binding enabled:

| Tap | Native result |
| --- | --- |
| Yes, implement this plan | Guarded Up/Down to the requested row, then one guarded Enter. Switches to Default and submits `Implement the plan.` once. |
| Yes, clear context and implement | The same guarded pointer walk and Enter. Starts a fresh context carrying the approved plan, then runs in Default mode. |
| No, stay in Plan mode | The same guarded pointer walk and Enter. Closes the menu without submitting work and leaves Plan mode active. |

Captures pin all three pointer states, the closed Plan-mode screen, and both implementation
outcomes. Arrow read-backs compare the plan body as part of identity, so a same-shaped menu
for another plan cannot continue a previous pointer walk. No key is retried on uncertain outcome.

After plan confirmation, an unrelated successor picker is not success evidence: the native plan
menu must close. Claude and Antigravity reject this exact Codex footer instead of treating its
Enter hint as their own digit-only folder-trust menu, including when the Agent banner has scrolled
out of the capture. The cross-harness fixture suite pins this boundary.

## Long-plan reading

Fast turns omit `Worked for`; slower turns can put that completion rule between the painted
body and the menu. `• Proposed Plan` identifies a complete body when its opening is visible.
If the capture begins inside the body, the card labels it a fragment until a matching original
is available. It does not invent missing rows or attempt to reconstruct terminal hard wraps.

The captured long plan has 9,192 source characters across 24 sections; the visible terminal
body holds only 1,829 characters. The complete Markdown is restored only when the entire
visible suffix matches the explicit proposed-plan journal entry. For complete visible plans,
the complete body must match. Matching accounts for Markdown syntax which Codex does not
display, such as a code fence's language name; the original source is displayed unchanged.
Truncated, stale, incomplete or repeated plan wrappers are refused.

The card reuses the existing Markdown renderer, Collapse and button primitives. The body has
a Markdown reading view for both the visible terminal text and a verified journal original;
source matching controls full-plan recovery, not whether Markdown is rendered. It has
a scroll region and can be folded; native decisions remain outside that scroller. In the dock
the plan and its recap share one scroller (2026-10-08).
Changing the selected option does not remount the reading area. Notes and unrelated agent
output keep their existing rendering and input flows.

## Resumed plans with a conversation recap — 2026-09-17

Codex can insert a dim horizontal rule, a bold `Conversation recap` heading between dim
rules, and unpainted recap paragraphs between the proposed plan and its implementation menu.
The earlier adjacency check rejected this whole screen. The parser now recognizes this
specific interstitial, including an optional `Worked for` completion rule, while retaining
the native menu labels, pointer paint, footer, painted body and tail anchoring checks.
Unknown interstitials, missing plan bodies and unstyled lookalikes stay raw.

The recap lives in `plan.recap`, never in `plan.text`: journal recovery must still match only
the proposed plan. Recap changes invalidate picker identity and pending pointer walks.
Both reading sections belong to the same card; the recap starts folded, uses the existing
Markdown renderer, and scrolls with the plan. Implementation choices stay outside both
reading areas. No cross-agent detector or native key recipe is broadened.

Parser and browser tests explicitly label their added recap text as structural mutations of
the existing native captures, rather than claiming these assembled variants are untouched
terminal recordings. Checks cover preserved blank lines, complete/partial source matching,
completion rules, stale recap identity, malformed boundaries, 320px English/Chinese layouts,
light/dark themes, Chromium/WebKit scrolling, folding and guarded option selection.

The read-only follow-up found the user's native session had already advanced beyond the
implementation menu. Its recap heading still confirmed the native bold/dim styling.
This round did not replay a resumed native confirmation; the three native decision outcomes
above are the existing isolated evidence, while the new recap variant is covered through
the actual client action layer with simulated API snapshots. No user-session input was sent.
