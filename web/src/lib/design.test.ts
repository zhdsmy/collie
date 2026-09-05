import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetDesign,
  DESIGN_STORAGE_KEY,
  designPrefs,
  initDesign,
  parseDesignPrefs,
  setDesignFont,
  setDesignTheme,
  subscribeDesign,
  useDesignPrefs,
} from "@/lib/design";

const prepaint = readFileSync(resolve(import.meta.dirname, "../../public/theme-init.js"), "utf8");

function prepaintClasses(raw: string | null, mode: string | null = null): string[] {
  const classes: string[] = [];
  runInNewContext(prepaint, {
    document: { documentElement: { classList: { add: (name: string) => classes.push(name) } } },
    localStorage: { getItem: (key: string) => key === DESIGN_STORAGE_KEY ? raw : mode },
  });
  return classes;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  __resetDesign();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  __resetDesign();
  document.documentElement.className = "";
});

describe("visual theme preferences", () => {
  it("leaves existing classic preferences and first paint unchanged", () => {
    initDesign();
    expect(designPrefs()).toEqual({ font: "aldrich" });
    expect(localStorage.getItem(DESIGN_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.className).toBe("");
    expect(prepaintClasses(null)).toEqual([]);

    setDesignFont("geist");
    expect(localStorage.getItem(DESIGN_STORAGE_KEY)).toBe('{"font":"geist"}');
    expect(prepaintClasses('{"font":"geist"}')).toEqual(["font-geist"]);
  });

  it("keeps the chosen font, color mode, terminal face and viewport classes when switching", () => {
    const display = JSON.stringify({ fontFamily: "geist-mono", wrap: true });
    localStorage.setItem("collie:theme:v1", "dark");
    localStorage.setItem("collie:display-prefs:v4", display);
    document.documentElement.classList.add("dark", "app-viewport-locked");
    setDesignFont("grotesk");

    setDesignTheme("animal-island");
    expect(designPrefs()).toEqual({ font: "grotesk", theme: "animal-island" });
    expect(document.documentElement).toHaveClass("theme-island", "font-grotesk", "dark", "app-viewport-locked");

    setDesignTheme("classic");
    expect(designPrefs()).toEqual({ font: "grotesk" });
    expect(localStorage.getItem(DESIGN_STORAGE_KEY)).toBe('{"font":"grotesk"}');
    expect(document.documentElement).not.toHaveClass("theme-island");
    expect(document.documentElement).toHaveClass("font-grotesk", "dark", "app-viewport-locked");
    expect(localStorage.getItem("collie:theme:v1")).toBe("dark");
    expect(localStorage.getItem("collie:display-prefs:v4")).toBe(display);
  });

  it("preserves the theme when choosing a shipped or operator font", () => {
    const face = { family: "Operator Sans", basename: "operator.woff2", weight: "400 700" };
    setDesignTheme("animal-island");
    setDesignFont("op:operator.woff2", face);
    expect(designPrefs()).toEqual({ font: "op:operator.woff2", theme: "animal-island", operatorFont: face });

    setDesignTheme("classic");
    expect(designPrefs()).toEqual({ font: "op:operator.woff2", operatorFont: face });
    setDesignTheme("animal-island");
    expect(designPrefs().operatorFont).toEqual(face);

    setDesignFont("geist");
    expect(designPrefs()).toEqual({ font: "geist", theme: "animal-island" });
    expect(document.documentElement).toHaveClass("theme-island", "font-geist");
    expect(document.documentElement).not.toHaveClass("font-operator");
  });

  it.each(["light", "dark", null])("agrees with pre-paint on a cold start in %s mode", (mode) => {
    const raw = JSON.stringify({ font: "geist", theme: "animal-island" });
    localStorage.setItem(DESIGN_STORAGE_KEY, raw);
    document.documentElement.classList.add(...prepaintClasses(raw, mode));
    const before = document.documentElement.className;
    __resetDesign();
    initDesign();
    expect(document.documentElement.className).toBe(before);
    expect(document.documentElement).toHaveClass("theme-island", "font-geist");
    expect(designPrefs()).toEqual({ font: "geist", theme: "animal-island" });
  });

  it.each([undefined, null, false, 42, {}, [], "classic", "future", "theme-island dark"])(
    "ignores an unrecognized stored theme: %j",
    (theme) => {
      const raw = JSON.stringify({ font: "geist", theme });
      expect(parseDesignPrefs(raw)).toEqual({ font: "geist" });
      expect(prepaintClasses(raw)).toEqual(["font-geist"]);
    },
  );

  it.each(["{", "null", "false", "[]", '"animal-island"'])("recovers from a malformed record: %s", (raw) => {
    expect(parseDesignPrefs(raw)).toEqual({ font: "aldrich" });
    expect(prepaintClasses(raw)).toEqual([]);
  });

  it("accepts the theme independently of a missing or invalid font", () => {
    const raw = JSON.stringify({ font: "font-system injected", theme: "animal-island" });
    expect(parseDesignPrefs(raw)).toEqual({ font: "aldrich", theme: "animal-island" });
    expect(prepaintClasses(raw)).toEqual(["theme-island"]);
  });

  it("reconciles a stale theme class without removing unrelated classes", () => {
    document.documentElement.classList.add("theme-island", "light", "app-viewport-locked");
    initDesign();
    expect(document.documentElement).not.toHaveClass("theme-island");
    expect(document.documentElement).toHaveClass("light", "app-viewport-locked");
  });

  it("notifies subscribed controls once per actual theme change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDesign(listener);
    const { result, unmount } = renderHook(() => useDesignPrefs());
    try {
      act(() => setDesignTheme("animal-island"));
      expect(result.current.theme).toBe("animal-island");
      act(() => setDesignTheme("animal-island"));
      expect(listener).toHaveBeenCalledTimes(1);
      act(() => setDesignTheme("classic"));
      expect(result.current.theme).toBeUndefined();
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      unsubscribe();
    }
  });

  it("keeps an in-memory choice usable when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    });
    expect(() => setDesignTheme("animal-island")).not.toThrow();
    expect(designPrefs().theme).toBe("animal-island");
    expect(document.documentElement).toHaveClass("theme-island");
    expect(() => setDesignTheme("classic")).not.toThrow();
    expect(document.documentElement).not.toHaveClass("theme-island");
  });

  it("falls back to classic when storage cannot be read", () => {
    setDesignTheme("animal-island");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    __resetDesign();
    expect(designPrefs()).toEqual({ font: "aldrich" });
    expect(document.documentElement).not.toHaveClass("theme-island");
    const add = vi.fn();
    runInNewContext(prepaint, {
      document: { documentElement: { classList: { add } } },
      localStorage: { getItem: () => { throw new Error("Storage unavailable"); } },
    });
    expect(add).not.toHaveBeenCalled();
  });
});
