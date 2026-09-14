import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetLocale } from "@/lib/i18n";

import { CodexModeToggle } from "./codex-mode-toggle";

beforeEach(() => __resetLocale());

describe("CodexModeToggle", () => {
  it.each([
    ["plan", "Plan mode: ON", "lucide-clipboard-check", "#d670d6"],
    ["fast", "Fast mode: ON", "lucide-zap", "#3b8eea"],
  ] as const)("renders compact %s control in dark-space colors", (mode, name, icon, color) => {
    const onClick = vi.fn();
    const view = render(<CodexModeToggle mode={mode} enabled busy={false} onClick={onClick} />);
    const wrapper = view.getByRole("button", { name }).parentElement!;

    expect(wrapper).toHaveAttribute("data-slot", "codex-mode-toggle");
    expect(wrapper).toHaveAttribute("data-mode", mode);
    expect(wrapper).not.toHaveClass("bg-background", "min-h-10", "px-3");
    expect(view.getByText(mode === "plan" ? "Plan" : "Fast")).toBeVisible();
    expect(wrapper.querySelector("svg")).toHaveClass(icon, "size-[12px]");
    expect(wrapper.querySelector("svg")?.style.color).toBe(
      color === "#d670d6" ? "rgb(214, 112, 214)" : "rgb(59, 142, 234)",
    );
    fireEvent.click(view.getByRole("button", { name }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the off Plan state without changing the compact control", () => {
    render(<CodexModeToggle mode="plan" enabled={false} onClick={vi.fn()} busy={false} />);

    const button = screen.getByRole("button", { name: "Plan mode: OFF" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent("Plan");
    expect(button.querySelector("svg")).toHaveClass("lucide-clipboard-list", "size-[12px]");
  });

  it("disables an unknown state and does not invoke the handler", () => {
    const onClick = vi.fn();
    render(<CodexModeToggle mode="plan" enabled={null} onClick={onClick} busy={false} />);

    const button = screen.getByRole("button", { name: "Plan mode: UNKNOWN" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses the Fast mode state and refusal reason for accessibility", () => {
    const reason = "Codex is working.";
    render(<CodexModeToggle mode="fast" enabled={false} busy={false} disabledReason={reason} onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Fast mode: OFF" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
    expect(button.parentElement).toHaveAttribute("title", reason);
    expect(button.parentElement).toHaveTextContent("Fast");
  });

  it("shows a busy spinner and keeps the button disabled", () => {
    render(<CodexModeToggle mode="fast" enabled={true} onClick={vi.fn()} busy />);

    const button = screen.getByRole("button", { name: "Fast mode: SWITCHING…" });
    expect(button).toBeDisabled();
    expect(button.querySelector("svg")).toHaveClass("lucide-loader-circle", "animate-spin");
  });
});
