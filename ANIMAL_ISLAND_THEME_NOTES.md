# Animal Island Theme Experiment

## Scope

Add a complete optional theme on `experiment/animal-island-theme`, preserving the
classic appearance and behavior from `v1.5.1+collie.15`.

The experiment must cover every route and UI state, not only shared buttons or
Settings. It must not replace the production installation, merge into `main`,
create Releases, or restore Actions without a separate request.

## Dependency Decision

Use the official `animal-island-ui-style` Skill installed from the upstream README
and the real library components, with their actual public TypeScript declarations.

| Fact | Inspected value |
| --- | --- |
| Source | https://github.com/guokaigdg/animal-island-ui |
| Clean source revision | `8ce0cd245db8a90e56524c6cda909c94d96406c2` |
| Demo | https://guokaigdg.github.io/animal-island-ui/#/ |
| Candidate package | `animal-island-ui@1.9.0` |
| Published | 2026-09-04 07:49:16 UTC |
| Required icon dependency | `lucide-react@^1.40.0`; `1.40.0` published 2026-09-03 08:56:22 UTC |
| License | CC BY-NC 4.0, noncommercial only, attribution required |
| Repository cooldown | 604800 seconds (7 days), unchanged |
| Installation | Installed after the approved cooldown exception: `animal-island-ui@1.9.0` and `lucide-react@1.40.0` |

The upstream history was rewritten for a DMCA cleanup. Do not use an older package
or recover removed assets to work around the cooldown. Inspect the publication
against the cleaned source and retain license and attribution before integration.
Transitive dependencies remain subject to the age gate. A live registry check on
2026-09-06 found no cooldown-eligible Lucide release satisfying `^1.40.0`, so an
exception for the theme library alone would not unblock installation. Request
approval for exactly `animal-island-ui@1.9.0` and `lucide-react@1.40.0`, leaving all
other dependency rules intact. Both become eligible by 2026-09-11 07:49:17 UTC.
Source vendoring is not a way around that gate.

## Theme Boundary

The existing `collie:design:v1` record owns the visual theme alongside the UI font.
An absent `theme` field means classic; `theme: "animal-island"` puts `theme-island`
on the document root at pre-paint and runtime. Root scoping also reaches portals.
The Settings choice stays hidden until the theme is implemented.

Keep `collie:theme:v1` (system/light/dark), UI/operator fonts, terminal fonts,
locale, drafts, and all other existing settings intact. The theme uses its own
Nunito/Noto Sans SC UI typography without overwriting the saved classic UI font.
Switching back must restore classic styling, not a close approximation.

Import `animal-island-ui/style` once at the app entry. Audit the library's global
CSS before importing it; fonts and resets must not alter classic rendering. Map
custom surfaces to the library's runtime `--animal-*` variables. Use library
components for visible controls, preserving native events, refs, focus and ARIA
contracts. Do not override their colors, radii or shadows with call-site classes.

The visual direction follows the official mint accent, parchment surfaces, brown
text and yellow input focus. Ribbon headings are the signature; keep operational
screens compact, with no decorative landing page. Preserve the terminal font for
verbatim output. Adapt mirror framing, input, diffs and statusline deliberately;
do not recolor absolute ANSI output or change the classic inversion contract.

The installed-iPhone viewport fix is a separate invariant: locked document root
`100lvh`, app height from live `visualViewport`. No theme may add a new viewport
height, body scroll, safe-area padding or background-push transform. See
`web/src/hooks/APP_VIEWPORT_NOTES.md` for the real-device evidence and limits of
desktop emulation.

## Coverage Ledger

Status is updated as each surface is implemented and verified.

| Surface | Required coverage | Status |
| --- | --- | --- |
| Preference foundation | Storage, font independence, cold start, switch-back, unavailable storage | Verified: 25 new cases and existing preference tests pass |
| Dependency integration | Approved exception for exact package and required icon version; public style import; license retained | Installed and typechecked; package API integration verified in Settings |
| Theme switcher | Classic/Animal Island independent of light/dark and fonts | Implemented; control test and mobile preview pass |
| Shared chrome token layer | Header, cards, forms, sheets, Composer, status target and statusline boundary | Implemented; full route audit and screenshot matrix pending |
| Shared primitives | Button/link, card, badge/chip, switch, sheet, notices, lists, labels, strips, toasts, chat input/list | Pending |
| Startup and root | Static pre-CSS splash, React splash, loading, root error, idle lock, foreground recovery | Pending |
| `/` | Dashboard cards/list, spaces, host labels, sidebar, empty/filter/loading/error states | Pending |
| `/space/:spaceId` | Overview, tabs, pane strips, session/host selection, create/rename/actions | Pending |
| `/settings` | Install, appearance, language, UI/terminal fonts, haptics, voice, zen, notifications, snooze, pairing/devices, pack, diagnostics, build stamp | Pending |
| `/settings/updates` | Update preferences, availability, progress, errors and version metadata | Pending |
| `/pack` | All member/role/connection states, lead/deputy views, operations and confirmations | Pending |
| `/pane/:paneId` | Header, mirror, Markdown, tables, diffs, submitted input, statusline, raw output, notices and search | Pending |
| `/pane/:paneId/history` | Journal entries, filters, loading/error/empty states, transcript controls | Pending |
| Composer and docks | Drafts, attachments, recording, send feedback, direct typing, all accessory keys/Fn/modifiers/queue, quick/agent/display docks | Pending |
| Agent interactions | Prompt, option, menu, wizard, multi-select, autocomplete, preview and approval blocks | Pending |
| Portals | Every bottom sheet, action menu, command palette, pairing and host/session switcher | Pending |
| Standalone controls | Raw buttons, inputs, selects, textareas, links styled as buttons; disabled/error/focus/selected states | Pending |
| Release boundary | Experimental branch only, CHANGELOG, no production replacement | Pending |

## Verification

Completion requires functional tests and screenshots of all ledger surfaces in
both themes, light/dark modes and mobile/desktop viewports. Include narrow layouts,
long labels, keyboard navigation, reduced motion, focus return, scrolling and
portals. Compare classic against baseline screenshots, not memory.

Run both typechecks, full-tree lint, frontend tests and the root atomic build.
Exercise send/draft/attachment flows against fixtures, without sending into live
terminals. Check every referenced asset, font loading, offline startup and CSP.
Start an independent preview and report its URL, leaving production untouched.

Desktop emulation does not prove installed-iOS safe-area behavior. Report that
boundary explicitly unless the new theme has also been checked on the real PWA.

### Foundation Checkpoint, 2026-09-06

The nonvisual foundation passes all 190 frontend suites: 5,267 passed and 30 existing
todo. Full-tree lint, root and web typechecks, and the atomic build pass with version
consistency. Dependencies and lockfiles contain the approved package versions. The
separate production checkout remains at `8d5eb1f` (`v1.5.1+collie.15`).
