import { useLayoutEffect, useRef } from "react";

// iOS can pan the visual viewport independently of both 100dvh and keyboard state.
// Anchor the whole app, not only the composer; route content remains the scroller.
export function useAppViewport() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const style = element.style;
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;

    function sync() {
      frame = 0;
      // Resizing during pinch zoom would reflow content and chase the user's pan.
      // WebKit can report 0.99999994 at normal scale, so allow rounding noise.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const height = viewport?.height ?? window.innerHeight;
      if (height <= 0) return;
      style.height = `${height}px`;
      style.top = `${Math.max(0, viewport?.offsetTop ?? 0)}px`;
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(sync);
    }

    root.classList.add("app-viewport-locked");
    sync();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule);
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
      root.classList.remove("app-viewport-locked");
    };
  }, []);

  return ref;
}
