import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetCodexModelRecents,
  CODEX_MODEL_RECENTS_MAX,
  CODEX_MODEL_RECENTS_STORAGE_KEY,
  useCodexModelRecents,
} from "./codex-model-recents";

function storedRaw(): string | null {
  return localStorage.getItem(CODEX_MODEL_RECENTS_STORAGE_KEY);
}

beforeEach(() => {
  localStorage.clear();
  __resetCodexModelRecents();
});

describe("useCodexModelRecents", () => {
  it("starts empty — a history that has not happened yet", () => {
    const { result } = renderHook(() => useCodexModelRecents());

    expect(result.current.recents).toEqual([]);
    expect(localStorage.getItem(CODEX_MODEL_RECENTS_STORAGE_KEY)).toBeNull();
  });

  it("puts the most recent pair first and moves a reused one back to the front", () => {
    const { result } = renderHook(() => useCodexModelRecents());

    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
      result.current.record("gpt-5.6-luna", "max");
    });
    expect(result.current.recents).toEqual([
      { model: "gpt-5.6-luna", effort: "max" },
      { model: "gpt-6-astra", effort: "xhigh" },
    ]);

    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
    });
    expect(result.current.recents).toEqual([
      { model: "gpt-6-astra", effort: "xhigh" },
      { model: "gpt-5.6-luna", effort: "max" },
    ]);
  });

  it("writes nothing when the pair is already at the front", () => {
    const { result } = renderHook(() => useCodexModelRecents());
    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
    });
    localStorage.removeItem(CODEX_MODEL_RECENTS_STORAGE_KEY);

    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
    });

    // No state change, no notification, no write — the re-record is the common case (once per send).
    expect(storedRaw()).toBeNull();
    expect(result.current.recents).toEqual([{ model: "gpt-6-astra", effort: "xhigh" }]);
  });

  it("drops the oldest pair past the cap", () => {
    const { result } = renderHook(() => useCodexModelRecents());

    act(() => {
      for (let i = 0; i <= CODEX_MODEL_RECENTS_MAX; i++) {
        result.current.record(`gpt-6-model${i}`, "high");
      }
    });

    expect(result.current.recents).toHaveLength(CODEX_MODEL_RECENTS_MAX);
    expect(result.current.recents[0]).toEqual({ model: `gpt-6-model${CODEX_MODEL_RECENTS_MAX}`, effort: "high" });
    expect(result.current.recents.some((entry) => entry.model === "gpt-6-model0")).toBe(false);
  });

  it("removes one pair and clears the whole history", () => {
    const { result } = renderHook(() => useCodexModelRecents());
    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
      result.current.record("gpt-5.6-luna", "max");
      result.current.record("gpt-5.6-sol", "low");
    });

    act(() => {
      result.current.remove("gpt-5.6-luna", "max");
    });
    expect(result.current.recents).toEqual([
      { model: "gpt-5.6-sol", effort: "low" },
      { model: "gpt-6-astra", effort: "xhigh" },
    ]);

    act(() => {
      result.current.clear();
    });
    expect(result.current.recents).toEqual([]);
    expect(localStorage.getItem(CODEX_MODEL_RECENTS_STORAGE_KEY)).toBe("[]");
  });

  it.each([
    ["not json at all", "{"],
    ["not a list", JSON.stringify({ model: "gpt-6-astra" })],
    ["a row with no effort", JSON.stringify([{ model: "gpt-6-astra" }])],
    ["a row with an unnameable effort", JSON.stringify([{ model: "gpt-6-astra", effort: "minimal" }])],
    ["a row with a blank model", JSON.stringify([{ model: "", effort: "high" }])],
    [
      "the same pair twice",
      JSON.stringify([
        { model: "gpt-6-astra", effort: "high" },
        { model: "gpt-6-astra", effort: "high" },
      ]),
    ],
  ])("ignores %s", (_label, raw) => {
    localStorage.setItem(CODEX_MODEL_RECENTS_STORAGE_KEY, raw);
    __resetCodexModelRecents();
    localStorage.setItem(CODEX_MODEL_RECENTS_STORAGE_KEY, raw);

    const { result } = renderHook(() => useCodexModelRecents());

    expect(result.current.recents).toEqual([]);
  });

  it("updates every subscribed component when one records", () => {
    const first = renderHook(() => useCodexModelRecents());
    const second = renderHook(() => useCodexModelRecents());

    act(() => {
      first.result.current.record("gpt-6-astra", "xhigh");
    });

    expect(second.result.current.recents).toEqual([{ model: "gpt-6-astra", effort: "xhigh" }]);
  });

  it("follows another tab, including a cleared history", () => {
    const { result } = renderHook(() => useCodexModelRecents());

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: CODEX_MODEL_RECENTS_STORAGE_KEY,
          newValue: JSON.stringify([{ model: "gpt-remote", effort: "low" }]),
        }),
      );
    });
    expect(result.current.recents).toEqual([{ model: "gpt-remote", effort: "low" }]);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: CODEX_MODEL_RECENTS_STORAGE_KEY, newValue: null }),
      );
    });
    expect(result.current.recents).toEqual([]);
  });
});
