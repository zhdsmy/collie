import { act, fireEvent, render, screen, within } from "@testing-library/react";

import type { DirectModifierState } from "@/hooks/use-direct-typing";
import { DirectKeyboardAccessory } from "./direct-keyboard-accessory";

const ALL_OFF: DirectModifierState = { ctrl: "off", alt: "off", shift: "off" };

describe("DirectKeyboardAccessory", () => {
  it("disables unsupported keys even when modifiers are armed", () => {
    const props = {
      modifiers: { ...ALL_OFF, ctrl: "once" } satisfies DirectModifierState,
      unsupportedKeys: ["Tab", "F12"],
      onToggleRow: vi.fn(),
      onToggleModifier: vi.fn(),
      onSendKeys: vi.fn(),
    };
    const { rerender } = render(<DirectKeyboardAccessory {...props} row="navigation" />);
    expect(screen.getByRole("button", { name: "Tab" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter" })).toBeEnabled();
    rerender(<DirectKeyboardAccessory {...props} row="function" />);
    expect(screen.getByRole("button", { name: "F12" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "F1" })).toBeEnabled();
  });

  it("keeps the switch fixed beside an icon-only navigation rail in keyboard order", () => {
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

    const root = screen.getByTestId("direct-keyboard-accessory");
    const switcher = screen.getByRole("button", { name: "Show function keys" });
    const rail = screen.getByTestId("direct-key-rail");
    expect(root).toContainElement(switcher);
    expect(root).toContainElement(rail);
    expect(switcher.parentElement).toBe(root);
    expect(root).toHaveClass("border-rule", "px-1.5");
    expect(rail).toHaveClass("overflow-x-auto", "flex", "min-w-0");
    expect(switcher).toHaveClass("shrink-0", "border-border", "bg-card");
    expect(switcher.querySelector("svg")).toHaveClass(
      "lucide-square-function",
      "size-[18px]",
    );
    for (const button of root.querySelectorAll("button")) {
      expect(button).toHaveClass("size-11", "shrink-0");
    }
    expect(screen.getByRole("button", { name: "Ctrl" })).toHaveClass(
      "border-border",
      "bg-card",
    );
    expect(screen.getByRole("button", { name: "Escape" })).toHaveClass(
      "border-border",
      "bg-card",
    );

    expect(
      within(rail)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Ctrl",
      "Escape",
      "Tab",
      "Up",
      "Down",
      "Left",
      "Right",
      "Enter",
      "Shift",
      "Alt",
    ]);
    const expectedIcons = [
      "lucide-chevron-up",
      "lucide-x",
      "lucide-arrow-right-to-line",
      "lucide-arrow-up",
      "lucide-arrow-down",
      "lucide-arrow-left",
      "lucide-arrow-right",
      "lucide-corner-down-left",
      "lucide-arrow-big-up",
      "lucide-option",
    ];
    within(rail)
      .getAllByRole("button")
      .forEach((button, index) => {
        expect(button).toHaveTextContent("");
        expect(button.querySelector("svg")).toHaveClass(expectedIcons[index], "size-[18px]");
      });

    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(onSendKeys).toHaveBeenCalledWith(["Enter"]);
  });

  it("overlays a locked modifier badge without moving or resizing its main icon", () => {
    render(
      <DirectKeyboardAccessory
        row="navigation"
        modifiers={{ ...ALL_OFF, ctrl: "locked" }}
        onToggleRow={vi.fn()}
        onToggleModifier={vi.fn()}
        onSendKeys={vi.fn()}
      />,
    );

    const ctrl = screen.getByRole("button", { name: "Ctrl" });
    expect(ctrl).toHaveClass("relative");
    expect(ctrl.querySelector(".lucide-chevron-up")).toHaveClass("size-[18px]");
    expect(ctrl.querySelector(".lucide-lock-keyhole")).toHaveClass(
      "absolute",
      "right-1",
      "top-1",
      "size-2.5",
    );
  });

  it("preserves arrow hold-repeat through the accessory sender", async () => {
    vi.useFakeTimers();
    try {
      const onSendKeys = vi.fn<(keys: string[]) => void>();
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

      const sent = onSendKeys.mock.calls.flatMap(([keys]) => keys);
      expect(sent.length).toBeGreaterThanOrEqual(3);
      expect(sent.every((key) => key === "Down")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
