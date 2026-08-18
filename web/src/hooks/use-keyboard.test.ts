import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { keyboardLikelyOpen, useKeyboardViewport } from "./use-keyboard";

afterEach(() => vi.unstubAllGlobals());

describe("keyboardLikelyOpen", () => {
  it("is closed when the height is unchanged", () => {
    expect(keyboardLikelyOpen(800, 800)).toBe(false);
  });

  it("ignores small drops like the URL bar collapsing", () => {
    expect(keyboardLikelyOpen(800, 720)).toBe(false); // -80px
  });

  it("is open when the height drops past a keyboard-sized amount", () => {
    expect(keyboardLikelyOpen(800, 480)).toBe(true); // -320px
  });

  it("is closed again once the height returns to baseline", () => {
    expect(keyboardLikelyOpen(800, 800)).toBe(false);
  });
});

describe("useKeyboardViewport", () => {
  it("tracks the iOS visual viewport offset while the keyboard is open", () => {
    const visualViewport = Object.assign(new EventTarget(), {
      height: 800,
      width: 390,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", visualViewport);

    const { result } = renderHook(() => useKeyboardViewport());
    act(() => {
      visualViewport.height = 480;
      visualViewport.offsetTop = 184;
      visualViewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ open: true, offsetTop: 184 });

    act(() => {
      visualViewport.offsetTop = 196;
      visualViewport.dispatchEvent(new Event("scroll"));
    });
    expect(result.current).toEqual({ open: true, offsetTop: 196 });

    act(() => {
      visualViewport.height = 800;
      visualViewport.offsetTop = 0;
      visualViewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ open: false, offsetTop: 0 });
  });
});
