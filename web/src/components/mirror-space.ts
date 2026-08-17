// The mirror's colour space, shared by every surface that renders terminal segments verbatim.
//
// Terminal colour is DARK-space colour: an agent picks bright yellow because it will sit on a near
// black background. So these surfaces are authored in dark space under every theme and the light
// theme inverts them wholesale, rather than re-theming the palette. See
// .adr/0002-invert-the-light-terminal-mirror.md — in short, three of the four harnesses emit
// overwhelmingly truecolor (opencode 100%, pi 89%, claude 79%), and truecolor names an absolute
// colour no palette can re-theme. Rendering it unchanged on white leaves most of an agent's output
// under 2:1.
//
// TWO surfaces need this now — the pane mirror's <pre> and the statusline strip above the composer —
// which is why it lives here instead of being spelled twice and drifting, the silent-failure class
// the ADR is about. The interactive blocks (prompt/wizard/preview/multi-select) are siblings of the
// mirror, not children, so they keep normal app theming and never invert.
//
// The colours are LITERAL dark-space values rather than theme tokens. That is a CONVENTION, not a
// constraint: `color-scheme: dark` on the element DOES flip an inherited light-dark() token
// (resolution is element-scoped, per spec), and these literals are byte-exact matches for
// --background / --foreground / --muted-foreground's dark halves, so either spelling renders the
// same pixels. Literals win because they sit beside the truecolor an agent emits — which nothing can
// re-theme — and say at the point of use that the value is deliberately theme-independent. What
// matters is that a mirror surface never mixes the two (ADR 0002, rule 2).
//
// `color-scheme: dark` still earns its place for native UI inside these surfaces (the x-overflow
// scrollbar, selection), which the filter then maps to light along with everything else.
//
// NEVER add a `dark:` variant inside one: it tracks the ROOT theme, which is backwards in an element
// that is dark under every theme and inverts in light.
import type { CSSProperties } from "react";

import type { AnsiSegment } from "@/lib/ansi";

export const MIRROR_SPACE = "[color-scheme:dark] bg-[#0a0a0a] text-[#fafafa]";
export const MIRROR_INVERT = "[filter:invert(1)_hue-rotate(180deg)] dark:[filter:none]";

// Codex paints its composer and submitted-query rows with this dark violet-grey. Normalize that one
// semantic chrome colour to the app's muted surface. The root variable is already expressed in the
// mirror's dark space: light roots provide the inverse of muted, while dark roots provide muted's
// dark half, so the outer filter lands on the same surface as the header and composer in both modes.
const CODEX_INPUT_BACKGROUND = "rgb(57,57,71)";
const CODEX_INPUT_SURFACE = "var(--mirror-codex-input-background)";

/** Resolve a terminal background into the mirror's dark colour space. */
export function mirrorBackground(background: string, agent?: string): string {
  return agent === "codex" && background === CODEX_INPUT_BACKGROUND
    ? CODEX_INPUT_SURFACE
    : background;
}

/** A segment's inline style. `muted` is the parser's own "this is TUI chrome" mark rather than an
 *  ANSI colour: drop the ANSI dim opacity so box-drawing and rule glyphs stay visible (var(--border)
 *  + dim was nearly invisible on mobile) and resolve it to #a1a1a1 — --muted-foreground's dark half,
 *  written literally to match MIRROR_SPACE, since everything on these surfaces is dark-space. */
export function styleFor(s: AnsiSegment, agent?: string): CSSProperties {
  const style = s.muted
    ? { ...s.style, color: "#a1a1a1", fontWeight: 400, opacity: 1 }
    : s.style;
  if (!s.bg) return style;

  // Mirror rows use 1.25 line-height, while an inline background paints only the 1em glyph box.
  // Vertical inline padding does not change line layout; half the extra leading on each side makes
  // terminal cell backgrounds meet instead of exposing page-coloured horizontal seams.
  return {
    ...style,
    backgroundColor: mirrorBackground(s.bg, agent),
    paddingBlock: "0.125em",
  };
}
