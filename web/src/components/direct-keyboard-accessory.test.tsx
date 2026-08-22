import { act, fireEvent, render, screen } from "@testing-library/react";

import type { DirectModifierState } from "@/hooks/use-direct-typing";
import { DirectKeyboardAccessory } from "./direct-keyboard-accessory";

const ALL_OFF: DirectModifierState = { ctrl: "off", alt: "off", shift: "off" };

describe("DirectKeyboardAccessory", () => {
  it("keeps the row switch fixed beside one horizontally scrolling rail", () => {
    render(
      <DirectKeyboardAccessory
        row="navigation"
        modifiers={ALL_OFF}
        onToggleRow={vi.fn()}
        onToggleModifier={vi.fn()}
        onSendKeys={vi.fn()}
      />,
    );

    const root = screen.getByTestId("direct-keyboard-accessory");
    const switcher = screen.getByRole("button", { name: "Show function keys" });
    const rail = screen.getByTestId("direct-key-rail");
    expect(root).toContainElement(switcher);
    expect(root).toContainElement(rail);
    expect(switcher.parentElement).toBe(root);
    expect(rail).toHaveClass("overflow-x-auto", "flex", "min-w-0");
    expect(switcher).toHaveClass("shrink-0");
    for (const button of root.querySelectorAll("button")) {
      expect(button).toHaveClass("size-10", "shrink-0");
    }
    expect(screen.getByRole("button", { name: "Ctrl" })).toHaveTextContent("⌃");
    expect(screen.getByRole("button", { name: "Alt" })).toHaveTextContent("⌥");
    expect(screen.getByRole("button", { name: "Shift" })).toHaveTextContent("⇧");
  });

  it("preserves arrow hold-repeat through the accessory sender", async () => {
    vi.useFakeTimers();
    try {
      const onSendKeys = vi.fn();
      render(
        <DirectKeyboardAccessory
          row="navigation"
          modifiers={ALL_OFF}
          onToggleRow={vi.fn()}
          onToggleModifier={vi.fn()}
          onSendKeys={onSendKeys}
        />,
      );

      const down = screen.getByRole("button", { name: "Down" });
      fireEvent.pointerDown(down, { pointerId: 1 });
      await act(async () => vi.advanceTimersByTimeAsync(550));
      fireEvent.pointerUp(down, { pointerId: 1 });
      await act(async () => Promise.resolve());

      const sent = onSendKeys.mock.calls.flatMap(([keys]) => keys as string[]);
      expect(sent.length).toBeGreaterThanOrEqual(3);
      expect(sent.every((key) => key === "Down")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
