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

  it("keeps the switch fixed beside labeled special keys and icon-only arrows in keyboard order", () => {
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
    expect(switcher).toHaveTextContent("Fn");
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
      "lucide-circle-arrow-out-up-left",
      "lucide-arrow-right-to-line",
      "lucide-arrow-up",
      "lucide-arrow-down",
      "lucide-arrow-left",
      "lucide-arrow-right",
      "lucide-corner-down-left",
      "lucide-arrow-big-up",
      "lucide-option",
    ];
    const expectedLabels = ["Ctrl", "Esc", "Tab", "", "", "", "", "Enter", "Shift", "Alt"];
    within(rail)
      .getAllByRole("button")
      .forEach((button, index) => {
        expect(button.textContent).toBe(expectedLabels[index]);
        expect(button.querySelector("svg")).toHaveClass(expectedIcons[index], "size-[18px]");
        if (expectedLabels[index]) {
          const label = within(button).getByText(expectedLabels[index]);
          expect(label).toHaveClass("text-[10px]", "leading-3", "font-medium");
          expect(label.parentElement).toHaveClass("flex-col", "items-center", "gap-0.5");
        } else {
          expect(button.querySelector("svg")).toHaveAttribute("stroke-width", "2.5");
        }
      });

    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    expect(onSendKeys).toHaveBeenCalledWith(["Enter"]);
  });

  it("preserves modifier legends and dimensions when armed, locked, or disabled", () => {
    const props = {
      row: "navigation" as const,
      onToggleRow: vi.fn(),
      onToggleModifier: vi.fn(),
      onSendKeys: vi.fn(),
    };
    const { rerender } = render(<DirectKeyboardAccessory {...props} modifiers={ALL_OFF} />);
    for (const mode of ["off", "once", "locked"] as const) {
      for (const disabled of [false, true]) {
        rerender(
          <DirectKeyboardAccessory
            {...props}
            modifiers={{ ...ALL_OFF, ctrl: mode }}
            disabled={disabled}
          />,
        );
        const ctrl = screen.getByRole("button", { name: "Ctrl" });
        expect(ctrl).toHaveClass("relative", "size-11", "shrink-0");
        expect(ctrl).toHaveAttribute("aria-pressed", String(mode !== "off"));
        expect(ctrl).toHaveTextContent("Ctrl");
        expect(ctrl.querySelector(".lucide-chevron-up")).toHaveClass("size-[18px]");
        expect(ctrl.matches(":disabled")).toBe(disabled);
        if (mode === "locked") {
          expect(ctrl.querySelector(".lucide-lock-keyhole")).toHaveClass(
            "absolute", "right-0.5", "top-0.5", "size-2",
          );
        } else {
          expect(ctrl.querySelector(".lucide-lock-keyhole")).toBeNull();
        }
      }
    }
  });

  it("labels the row switch without changing function key legends or sending behavior", () => {
    const props = {
      modifiers: ALL_OFF,
      onToggleRow: vi.fn(),
      onToggleModifier: vi.fn(),
      onSendKeys: vi.fn(),
    };
    const { rerender } = render(<DirectKeyboardAccessory {...props} row="navigation" />);
    fireEvent.click(screen.getByRole("button", { name: "Show function keys" }));
    expect(props.onToggleRow).toHaveBeenCalledOnce();
    rerender(<DirectKeyboardAccessory {...props} row="function" />);
    const switcher = screen.getByRole("button", { name: "Show navigation keys" });
    expect(switcher).toHaveTextContent("Nav");
    expect(switcher.querySelector("svg")).toHaveClass("lucide-keyboard", "size-[18px]");
    for (let index = 1; index <= 12; index++) {
      const key = screen.getByRole("button", { name: `F${index}` });
      expect(key.textContent).toBe(`F${index}`);
      expect(key.querySelector("svg")).toBeNull();
      expect(key).toHaveClass("size-11", "shrink-0");
      fireEvent.click(key);
      expect(props.onSendKeys).toHaveBeenLastCalledWith([`F${index}`]);
    }
    fireEvent.click(switcher);
    expect(props.onToggleRow).toHaveBeenCalledTimes(2);
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
