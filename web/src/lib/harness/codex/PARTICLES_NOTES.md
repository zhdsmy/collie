# Codex 0.154 composer particles — 2026-09-12

Official source: [`render_stars` in `chat_composer/sparkle.rs`](https://github.com/openai/codex/blob/rust-v0.154.0/codex-rs/tui/src/bottom_pane/chat_composer/sparkle.rs).
It paints only space cells with RGB backgrounds, skipping the cursor, modified cells and cells
with a diff option. Its eight glyphs are `⠁⠂⠄⠈⠐⠠⡀⢀`; their RGB ink blends the foreground
with each cell's background as brightness changes. The effect covers the composer surface even
when the input contains text. This confirms why removing only empty-composer decorations or
matching one captured frame cannot work. Differently painted selection or attachment regions
currently fail closed and keep the original output rather than broaden the recognizer.

The installed `codex-cli 0.154.0` paints moving single-dot Braille cells on its composer
background. They occupy space cells in all three parts of the input area: top padding,
the text area (including spaces within a nonempty draft), and bottom padding. They may
replace the space immediately after the bold `›` marker. Placeholder text remains dim.

The working fixture retains the ANSI composer/status tail of a read-only Herdr capture;
its preceding private transcript was replaced with a generic Working indicator. The draft
fixture comes from a temporary, unfocused Codex pane in this repository: the sample was
typed without Enter or a model request. Only the last composer/status rows and generic
sample output were retained. The scratch pane was subsequently found already closed.

Captured particle cells have independent RGB foreground colors, the same background as
the composer, and no bold/dim/italic/underline/strike. Actual typed `⠁⠂`, punctuation,
`[Image #1]`, CJK text and an absolute path use normal text paint. Consequently a Unicode
character filter alone is incorrect: animation cells must become spaces while actual
typed Braille must remain intact.

`normalizeComposerParticles` requires the existing Codex status recognizer at the tail,
a contiguous common-background input area, decorated padding above and below, and the
live bold, non-dim prompt marker. Unstyled, partial, unfamiliar or non-tail shapes retain
their original rows. No terminal width, model name, background RGB value, working state,
or placeholder string is used to decide which glyphs are animation. Row/character offsets
remain unchanged. The ordinary chrome parser then sees the original blank padding and
text, including the dim empty placeholder. Raw terminal mode still shows the actual TUI.

The bridge imports this small pure recognizer plus the existing pure ANSI/line parser;
it does not import the adapter registry, dialog code, React runtime or network functions.
This is deliberate: independently reimplementing particle stripping for `expected_prompt`
would make either sending or stale-screen protection depend on two grammars staying equal.
The phone binds the normalized literal draft. The bridge normalizes only a complete painted
composer before its existing exact, contiguous, tail-bounded comparison. A change to real
words, internal spaces, typed Braille, or replacement by a dialog must still refuse the write.

Tests cover captures and derived animation frames, empty/typed states, the prompt gutter,
plain text, empty paragraphs, single/multiple image markers, mixed image/text and absolute
paths, plus negative cases and the existing adapter corpus. Browser tests use mocked APIs
at 320/390 CSS pixels in light/dark themes; they are not iPhone PWA or live message-send tests.
