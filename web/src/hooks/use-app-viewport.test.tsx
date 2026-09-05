import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppViewport } from "./use-app-viewport";

function Viewport() {
  const ref = useAppViewport();
  return <div ref={ref} data-testid="viewport" />;
}

function mount() {
  return render(
    <StrictMode>
      <Viewport />
    </StrictMode>,
  );
}

describe("useAppViewport", () => {
  let viewport: EventTarget & { height: number; offsetTop: number; scale: number };

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
    vi.stubGlobal("visualViewport", viewport);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function change(height: number, offsetTop: number, event = "resize") {
    act(() => {
      Object.assign(viewport, { height, offsetTop });
      viewport.dispatchEvent(new Event(event));
      vi.advanceTimersByTime(20);
    });
  }

  it("locks document scrolling and sizes the shell before first paint", () => {
    const { getByTestId } = mount();
    expect(document.documentElement).toHaveClass("app-viewport-locked");
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px", top: "0px" });
  });

  it("follows scroll-only panning without needing a keyboard or resize", () => {
    const { getByTestId } = mount();
    change(844, 54, "scroll");
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px", top: "54px" });
    change(844, 0, "scroll");
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px", top: "0px" });
  });

  it("tracks small viewport changes that never count as a keyboard", () => {
    const { getByTestId } = mount();
    change(790, 0);
    expect(getByTestId("viewport")).toHaveStyle({ height: "790px", top: "0px" });
    change(844, 0);
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px", top: "0px" });
  });

  it("reconciles height and offset through keyboard and rotation cycles", () => {
    const { getByTestId } = mount();
    for (let i = 0; i < 3; i++) {
      for (const [height, top] of [[460, 120], [844, 54], [844, 0], [390, 0], [844, 0]] as const) {
        change(height, top);
        const style = getByTestId("viewport").style;
        expect(Number.parseFloat(style.top) + Number.parseFloat(style.height)).toBe(height + top);
      }
    }
  });

  it.each(["pageshow", "resize", "scroll", "visibilitychange"])(
    "refreshes stale measurements on %s without a viewport event",
    (event) => {
      const { getByTestId } = mount();
      Object.assign(viewport, { height: 810, offsetTop: 34 });
      act(() => {
        (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event));
        vi.advanceTimersByTime(20);
      });
      expect(getByTestId("viewport")).toHaveStyle({ height: "810px", top: "34px" });
    },
  );

  it("leaves pinch zoom alone and resynchronizes when unzoomed", () => {
    const { getByTestId } = mount();
    viewport.scale = 2;
    change(422, 200);
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px", top: "0px" });
    viewport.scale = 1;
    change(844, 0);
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px", top: "0px" });
  });

  it("ignores zero-height transient measurements and negative overscroll", () => {
    const { getByTestId } = mount();
    change(0, 0);
    expect(getByTestId("viewport")).toHaveStyle({ height: "844px" });
    change(844, -34, "scroll");
    expect(getByTestId("viewport")).toHaveStyle({ top: "0px" });
  });

  it("does not mistake WebKit scale rounding for pinch zoom", () => {
    viewport.scale = 0.99999994;
    const { getByTestId } = mount();
    change(932, 54, "scroll");
    expect(getByTestId("viewport")).toHaveStyle({ height: "932px", top: "54px" });
  });

  it("falls back to the window on browsers without visualViewport", () => {
    vi.stubGlobal("visualViewport", undefined);
    vi.stubGlobal("innerHeight", 900);
    const { getByTestId } = mount();
    expect(getByTestId("viewport")).toHaveStyle({ height: "900px", top: "0px" });
  });

  it("unlocks the document and cancels pending work on unmount", () => {
    const { getByTestId, unmount } = mount();
    const element = getByTestId("viewport");
    viewport.height = 400;
    viewport.dispatchEvent(new Event("resize"));
    unmount();
    expect(document.documentElement).not.toHaveClass("app-viewport-locked");
    change(450, 20);
    expect(element).toHaveStyle({ height: "844px", top: "0px" });
  });
});
