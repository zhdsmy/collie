import { describe, expect, it, vi } from "vitest";

import type { UseTerminalFontReturn } from "./use-terminal-font";

const STORAGE_KEY = "collie:terminal-font:v1";

async function bootstrap(stored: string | null) {
  localStorage.clear();
  if (stored !== null) localStorage.setItem(STORAGE_KEY, stored);
  delete document.documentElement.dataset.terminalFont;
  vi.resetModules();
  return (await import("./use-terminal-font")) as {
    useTerminalFont: () => UseTerminalFontReturn;
  };
}

describe("useTerminalFont store", () => {
  it("defaults to SF Mono and stamps the root before a control mounts", async () => {
    await bootstrap(null);
    expect(document.documentElement.dataset.terminalFont).toBe("sf-mono");
  });

  it.each(["sf-mono", "geist-mono", "jetbrains-mono"] as const)(
    "restores %s from localStorage",
    async (stored) => {
      await bootstrap(stored);
      expect(document.documentElement.dataset.terminalFont).toBe(stored);
    },
  );

  it("ignores an unknown stored face", async () => {
    await bootstrap("comic-sans");
    expect(document.documentElement.dataset.terminalFont).toBe("sf-mono");
  });

  it("persists a selection and applies it immediately", async () => {
    const { useTerminalFont } = await bootstrap(null);
    const { act, renderHook } = await import("@testing-library/react");
    const { result } = renderHook(() => useTerminalFont());

    act(() => result.current.setFont("geist-mono"));

    expect(result.current.font).toBe("geist-mono");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("geist-mono");
    expect(document.documentElement.dataset.terminalFont).toBe("geist-mono");
  });
});
