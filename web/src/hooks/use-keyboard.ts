import { useEffect, useState } from "react";

// Detect whether the on-screen keyboard is open and where iOS has panned the visual viewport.
//
// The viewport meta uses `interactive-widget=resizes-content`, so when the soft keyboard opens BOTH
// the layout and visual viewport shrink together — which means the usual trick of comparing
// `window.innerHeight` to `visualViewport.height` reads ~0 and can't see the keyboard. What DOES
// still change is the absolute height: it drops by the keyboard's height. So we remember the tallest
// height seen while closed (the baseline) and call the keyboard "open" once the current height falls
// well below it.
//
// Why this exists: a textarea keeps DOM focus when Android collapses the keyboard (no `blur` fires),
// so focus alone can't tell us the keyboard closed — but the viewport resize always does. The
// visual viewport's scroll event separately keeps its top offset current during iOS focus panning.

// Threshold (px) for the height drop to count as a keyboard: large enough to ignore the URL bar
// showing/hiding (~60–100px), smaller than any soft keyboard (~250px+).
const KEYBOARD_MIN_PX = 150;

/** Pure predicate (testable): the keyboard is likely open when the height dropped past the threshold. */
export function keyboardLikelyOpen(
  baselineHeight: number,
  currentHeight: number,
  threshold = KEYBOARD_MIN_PX,
): boolean {
  return baselineHeight - currentHeight > threshold;
}

interface KeyboardViewport {
  open: boolean;
  offsetTop: number;
}

export function useKeyboardViewport(): KeyboardViewport {
  const [viewport, setViewport] = useState<KeyboardViewport>({ open: false, offsetTop: 0 });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let baseline = vv.height;
    let baselineWidth = vv.width;
    const commit = (open: boolean) => {
      // iOS pans the visual viewport to keep the focused textarea above the keyboard. A CSS-fixed
      // header remains at the layout viewport's top unless we carry this offset into its position.
      const offsetTop = open ? Math.max(0, vv.offsetTop) : 0;
      setViewport((current) =>
        current.open === open && current.offsetTop === offsetTop
          ? current
          : { open, offsetTop },
      );
    };
    const update = () => {
      // A width change is an orientation/layout change, not the keyboard — re-baseline so a portrait
      // baseline doesn't read as "open" in landscape.
      if (vv.width !== baselineWidth) {
        baselineWidth = vv.width;
        baseline = vv.height;
        commit(false);
        return;
      }
      baseline = Math.max(baseline, vv.height);
      commit(keyboardLikelyOpen(baseline, vv.height));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return viewport;
}
