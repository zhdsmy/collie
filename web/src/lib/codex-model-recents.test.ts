import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetCodexModelRecents,
  CODEX_MODEL_RECENTS_MAX,
  CODEX_MODEL_RECENTS_STORAGE_KEY,
  codexModelRecentsStorageKey,
  clearRecents,
  useCodexModelRecents,
} from "./codex-model-recents";

const SESSION_A = "codex-sha256:session-a";
const SESSION_B = "codex-sha256:session-b";

function storedRaw(codexSessionKey = SESSION_A): string | null {
  return localStorage.getItem(codexModelRecentsStorageKey(codexSessionKey));
}

beforeEach(() => {
  localStorage.clear();
  __resetCodexModelRecents();
});

describe("useCodexModelRecents", () => {
  it("keeps the legacy global list untouched and does nothing without a session key", () => {
    const legacy = JSON.stringify([{ model: "gpt-5.6-luna", effort: "max" }]);
    localStorage.setItem(CODEX_MODEL_RECENTS_STORAGE_KEY, legacy);
    const { result } = renderHook(() => useCodexModelRecents(undefined));

    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
      result.current.remove("gpt-6-astra", "xhigh");
      result.current.clear();
    });

    expect(result.current.recents).toEqual([]);
    expect(localStorage.getItem(CODEX_MODEL_RECENTS_STORAGE_KEY)).toBe(legacy);
    expect(localStorage.length).toBe(1);
  });

  it("loads and orders pairs independently for each session", () => {
    const first = renderHook(() => useCodexModelRecents(SESSION_A));
    const second = renderHook(() => useCodexModelRecents(SESSION_B));

    act(() => {
      first.result.current.record("gpt-6-astra", "xhigh");
      first.result.current.record("gpt-5.6-luna", "max");
      second.result.current.record("gpt-5.6-sol", "low");
    });

    expect(first.result.current.recents).toEqual([
      { model: "gpt-5.6-luna", effort: "max" },
      { model: "gpt-6-astra", effort: "xhigh" },
    ]);
    expect(second.result.current.recents).toEqual([{ model: "gpt-5.6-sol", effort: "low" }]);

    const sameSession = renderHook(() => useCodexModelRecents(SESSION_A));
    expect(sameSession.result.current.recents).toEqual(first.result.current.recents);
    expect(storedRaw(SESSION_B)).toBe(JSON.stringify([{ model: "gpt-5.6-sol", effort: "low" }]));
  });

  it("moves a reused pair to the front without writing when it is already first", () => {
    const { result } = renderHook(() => useCodexModelRecents(SESSION_A));
    act(() => {
      result.current.record("gpt-6-astra", "xhigh");
      result.current.record("gpt-5.6-luna", "max");
    });

    act(() => result.current.record("gpt-6-astra", "xhigh"));
    expect(result.current.recents[0]).toEqual({ model: "gpt-6-astra", effort: "xhigh" });

    localStorage.removeItem(codexModelRecentsStorageKey(SESSION_A));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => result.current.record("gpt-6-astra", "xhigh"));
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("bounds each session to the newest pairs", () => {
    const { result } = renderHook(() => useCodexModelRecents(SESSION_A));
    act(() => {
      for (let i = 0; i <= CODEX_MODEL_RECENTS_MAX; i += 1) {
        result.current.record(`gpt-6-model${i}`, "high");
      }
    });

    expect(result.current.recents).toHaveLength(CODEX_MODEL_RECENTS_MAX);
    expect(result.current.recents[0]).toEqual({
      model: `gpt-6-model${CODEX_MODEL_RECENTS_MAX}`,
      effort: "high",
    });
    expect(result.current.recents.some((entry) => entry.model === "gpt-6-model0")).toBe(false);
  });

  it("removes one pair and clears only the selected session", () => {
    const { result: first } = renderHook(() => useCodexModelRecents(SESSION_A));
    const { result: second } = renderHook(() => useCodexModelRecents(SESSION_B));
    act(() => {
      first.current.record("gpt-6-astra", "xhigh");
      first.current.record("gpt-5.6-luna", "max");
      second.current.record("gpt-5.6-sol", "low");
    });

    act(() => first.current.remove("gpt-5.6-luna", "max"));
    expect(first.current.recents).toEqual([{ model: "gpt-6-astra", effort: "xhigh" }]);
    act(() => clearRecents(SESSION_A));
    expect(first.current.recents).toEqual([]);
    expect(second.current.recents).toEqual([{ model: "gpt-5.6-sol", effort: "low" }]);
    expect(storedRaw(SESSION_A)).toBe("[]");
  });

  it.each([
    ["not json", "{"],
    ["not a list", JSON.stringify({ model: "gpt-6-astra" })],
    ["missing effort", JSON.stringify([{ model: "gpt-6-astra" }])],
    ["unknown effort", JSON.stringify([{ model: "gpt-6-astra", effort: "minimal" }])],
    ["blank model", JSON.stringify([{ model: "", effort: "high" }])],
    [
      "duplicate pair",
      JSON.stringify([
        { model: "gpt-6-astra", effort: "high" },
        { model: "gpt-6-astra", effort: "high" },
      ]),
    ],
  ])("ignores corrupt session payload: %s", (_label, raw) => {
    localStorage.setItem(codexModelRecentsStorageKey(SESSION_A), raw);
    const { result } = renderHook(() => useCodexModelRecents(SESSION_A));
    expect(result.current.recents).toEqual([]);
  });

  it("follows a loaded session's storage event without writing it back", () => {
    const { result } = renderHook(() => useCodexModelRecents(SESSION_A));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: codexModelRecentsStorageKey(SESSION_A),
          newValue: JSON.stringify([{ model: "gpt-remote", effort: "low" }]),
        }),
      );
    });
    expect(result.current.recents).toEqual([{ model: "gpt-remote", effort: "low" }]);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: codexModelRecentsStorageKey(SESSION_A), newValue: null }),
      );
    });
    expect(result.current.recents).toEqual([]);
  });

  it("does not eagerly load an unrelated session storage event", () => {
    localStorage.setItem(
      codexModelRecentsStorageKey(SESSION_B),
      JSON.stringify([{ model: "gpt-remote", effort: "low" }]),
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: codexModelRecentsStorageKey(SESSION_B),
          newValue: JSON.stringify([{ model: "gpt-event", effort: "high" }]),
        }),
      );
    });

    const { result } = renderHook(() => useCodexModelRecents(SESSION_B));
    expect(result.current.recents).toEqual([{ model: "gpt-remote", effort: "low" }]);
  });
});
