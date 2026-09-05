# Standalone iPhone Viewport Regression

## Real-device A/B, 2026-09-05

iPhone 15 Pro Max, iOS 26.6.1, installed Collie PWA. Measured over the phone's Web
Inspector, not desktop device emulation. Screen: 430 x 932 CSS pixels; safe-area
insets: 59px top, 34px bottom. Keyboard closed, scale 1, viewport offset 0.

Changing only `html.app-viewport-locked` height, twice in each direction:

| Root height | innerHeight / visualViewport.height | App bottom | Input bottom | Hit test at (20, 900) |
| --- | --- | --- | --- | --- |
| `100%` | 873 | 873 | 857 | Outside viewport |
| `100lvh` | 932 | 932 | 916 | Textarea |

The document and body remain scroll-locked. The app still follows the visual
viewport through `useAppViewport`; do not give the app an unconditional `100lvh`
height, which would put its composer behind an open keyboard.

Increasing only the app height to 932, even with visible overflow, did not repair
the viewport: the input was clipped, probes below y=873 did not render, and those
coordinates failed hit testing. Blurring the input and scrolling to zero also did
not recover the missing extent. This is not composer padding or a bottom inset.

Three subsequent real-device focus/blur cycles with Web Inspector user-gesture
emulation opened the software keyboard (visual viewport 492px, input bottom
484px). Every dismissal restored the 932px viewport, input bottom 916px, and
document scrollY 0. Both keyboard-open and keyboard-closed page snapshots were
inspected. Web Inspector snapshots exclude native keyboard and status-bar pixels.

## Verification Boundary

Desktop WebKit/Chromium and mocked visualViewport tests do not reproduce this iOS
standalone geometry. An assertion that the footer equals visualViewport.bottom is
necessary but insufficient: both can be wrong by the same 59 pixels.

On the actual installed PWA, with the keyboard closed and scale 1, compare the
viewport and app bottom with the screen extent, inspect a screenshot including
the bottom edge, and hit-test inside the input where the missing band used to be.
Repeat after keyboard dismissal, foreground return, rotation, and a cold launch.
While the keyboard is open, compare the composer with the visual viewport instead
of the full screen. Preserve drafts; no terminal sends are needed for these checks.
