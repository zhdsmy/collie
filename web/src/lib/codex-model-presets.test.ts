import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetCodexModelPresets,
  CODEX_MODEL_PRESETS_STORAGE_KEY,
  useCodexModelPresets,
} from "./codex-model-presets";

beforeEach(() => {
  localStorage.clear();
  __resetCodexModelPresets();
});

describe("useCodexModelPresets", () => {
  it("starts with the two defaults", () => {
    const { result } = renderHook(() => useCodexModelPresets());

    expect(result.current.presets.map(({ model, effort }) => ({ model, effort }))).toEqual([
      { model: "gpt-6-astra", effort: "xhigh" },
      { model: "gpt-5.6-luna", effort: "max" },
    ]);
  });

  it("persists an intentionally empty list", () => {
    const { result } = renderHook(() => useCodexModelPresets());

    act(() => {
      expect(result.current.save([])).toBe(true);
    });

    expect(result.current.presets).toEqual([]);
    expect(localStorage.getItem(CODEX_MODEL_PRESETS_STORAGE_KEY)).toBe("[]");
  });

  it("rejects duplicate model and effort pairs without changing the list", () => {
    const { result } = renderHook(() => useCodexModelPresets());
    const duplicate = result.current.presets.map((preset) => ({
      ...preset,
      model: result.current.presets[0]!.model,
      effort: result.current.presets[0]!.effort,
    }));

    let saved!: boolean;
    act(() => {
      saved = result.current.save(duplicate);
    });

    expect(saved).toBe(false);
    expect(result.current.error).toBe("invalid");
    expect(result.current.presets).toHaveLength(2);
  });

  it("updates every subscribed component when one component saves", () => {
    const first = renderHook(() => useCodexModelPresets());
    const second = renderHook(() => useCodexModelPresets());
    const next = [{ id: "custom", model: "gpt-custom", effort: "high" as const }];

    act(() => {
      expect(first.result.current.save(next)).toBe(true);
    });

    expect(second.result.current.presets).toEqual(next);
  });

  it("accepts a valid storage event from another tab", () => {
    const { result } = renderHook(() => useCodexModelPresets());
    const next = [{ id: "remote", model: "gpt-remote", effort: "low" as const }];

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: CODEX_MODEL_PRESETS_STORAGE_KEY,
          newValue: JSON.stringify(next),
        }),
      );
    });

    expect(result.current.presets).toEqual(next);
  });
});
