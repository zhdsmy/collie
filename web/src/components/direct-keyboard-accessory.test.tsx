import { act, fireEvent, render, screen, within } from "@testing-library/react";

import type { DirectModifierState } from "@/hooks/use-direct-typing";
import { DirectKeyboardAccessory } from "./direct-keyboard-accessory";

const ALL_OFF: DirectModifierState = { ctrl: "off", alt: "off", shift: "off" };

/** Which of the switch's three page dots is filled. */
function currentDot(switcher: HTMLElement): number {
  const dots = [...switcher.querySelectorAll("span.rounded-full")];
  expect(dots).toHaveLength(3);
  return dots.findIndex((dot) => dot.hasAttribute("data-current"));
}

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
    const switcher = screen.getByRole("button", { name: "Show key combos" });
    const rail = screen.getByTestId("direct-key-rail");
    expect(root).toContainElement(switcher);
    expect(root).toContainElement(rail);
    expect(switcher.parentElement).toBe(root);
    expect(root).toHaveClass("border-rule", "px-1.5");
    expect(rail).toHaveClass("overflow-x-auto", "flex", "min-w-0");
    expect(switcher).toHaveClass("shrink-0", "border-border", "bg-card");
    // The switch wears the row it is ON, and three dots say which page: the first, here.
    expect(switcher.querySelector("svg")).toHaveClass(
      "lucide-keyboard",
      "size-[18px]",
    );
    expect(switcher).toHaveTextContent("");
    expect(currentDot(switcher)).toBe(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Show key combos" }));
    expect(props.onToggleRow).toHaveBeenCalledOnce();
    rerender(<DirectKeyboardAccessory {...props} row="function" />);
    const switcher = screen.getByRole("button", { name: "Show navigation keys" });
    expect(switcher.querySelector("svg")).toHaveClass("lucide-square-function", "size-[18px]");
    expect(currentDot(switcher)).toBe(2);
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

  it("sends each common combo whole, whatever modifier is latched, and leads on to the function keys", () => {
    const props = {
      modifiers: { ...ALL_OFF, ctrl: "once" as const },
      onToggleRow: vi.fn(),
      onToggleModifier: vi.fn(),
      onSendKeys: vi.fn(),
    };
    render(<DirectKeyboardAccessory {...props} row="combos" />);
    // The latched Ctrl has no key on this page, so the switch carries it, in its face and its name.
    const switcher = screen.getByRole("button", { name: "Show function keys · Ctrl" });
    expect(switcher.querySelector("svg")).toHaveClass("lucide-combine", "size-[18px]");
    expect(switcher).toHaveTextContent("^");
    expect(currentDot(switcher)).toBe(1);
    for (const [name, key] of [["Shift+Tab", "shift+Tab"], ["Shift+Left", "shift+Left"], ["Ctrl+C", "ctrl+c"]] as const) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("size-11", "shrink-0");
      fireEvent.click(button);
      expect(props.onSendKeys).toHaveBeenLastCalledWith([key]);
    }
  });

  it("carries every latched modifier onto the pages without modifier keys, and only there", () => {
    const props = {
      modifiers: { ctrl: "locked", alt: "off", shift: "once" } satisfies DirectModifierState,
      onToggleRow: vi.fn(),
      onToggleModifier: vi.fn(),
      onSendKeys: vi.fn(),
    };
    const { rerender } = render(<DirectKeyboardAccessory {...props} row="navigation" />);
    // Its own keys show it here; the switch stays plain.
    expect(screen.getByRole("button", { name: "Show key combos" })).toHaveTextContent("");
    rerender(<DirectKeyboardAccessory {...props} row="function" />);
    expect(screen.getByRole("button", { name: "Show navigation keys · Ctrl+Shift" })).toHaveTextContent("^⇧");
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

  it("treats a swipe across the rail as a scroll, never a key", async () => {
    vi.useFakeTimers();
    try {
      const onSendKeys = vi.fn<(keys: string[]) => void>();
      const onToggleModifier = vi.fn();
      render(
        <DirectKeyboardAccessory
          row="navigation"
          modifiers={ALL_OFF}
          onToggleRow={vi.fn()}
          onToggleModifier={onToggleModifier}
          onSendKeys={onSendKeys}
        />,
      );
      const rail = screen.getByTestId("direct-key-rail");
      const esc = screen.getByRole("button", { name: "Escape" });
      const swipe = (el: HTMLElement, dx: number) => {
        fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 10 });
        fireEvent.pointerMove(el, { pointerId: 1, clientX: 100 + dx, clientY: 10 });
        fireEvent.pointerUp(el, { pointerId: 1, clientX: 100 + dx, clientY: 10 });
        fireEvent.click(el, { detail: 1 });
      };

      swipe(esc, -40);
      swipe(screen.getByRole("button", { name: "Ctrl" }), 30);
      // The rail moved under a finger that barely did.
      fireEvent.pointerDown(esc, { pointerId: 1, clientX: 100, clientY: 10 });
      rail.scrollLeft = 60;
      fireEvent.click(esc, { detail: 1 });
      // A held arrow that turns into a swipe never starts repeating.
      const down = screen.getByRole("button", { name: "Down" });
      fireEvent.pointerDown(down, { pointerId: 1, clientX: 100, clientY: 10 });
      fireEvent.pointerMove(down, { pointerId: 1, clientX: 60, clientY: 10 });
      await act(async () => vi.advanceTimersByTimeAsync(550));
      expect(onSendKeys).not.toHaveBeenCalled();
      expect(onToggleModifier).not.toHaveBeenCalled();

      // A tap that jitters a few pixels is still a tap, and so is a keyboard activation.
      swipe(esc, 4);
      expect(onSendKeys).toHaveBeenLastCalledWith(["Escape"]);
      fireEvent.click(screen.getByRole("button", { name: "Tab" }));
      expect(onSendKeys).toHaveBeenLastCalledWith(["Tab"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
