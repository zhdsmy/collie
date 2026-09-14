import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { __resetLocale } from "@/lib/i18n";

import { CodexPlanToggle } from "./codex-plan-toggle";

beforeEach(() => __resetLocale());

describe("CodexPlanToggle", () => {
  it("shows enabled Plan mode and accepts a click", () => {
    const onClick = vi.fn();
    render(<CodexPlanToggle enabled onClick={onClick} busy={false} />);

    const button = screen.getByRole("button", { name: "Plan mode: ON" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows disabled Plan mode and preserves the same control", () => {
    render(<CodexPlanToggle enabled={false} onClick={vi.fn()} busy={false} />);

    const button = screen.getByRole("button", { name: "Plan mode: OFF" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toBeDisabled();
  });

  it("disables an unknown state and does not invoke the handler", () => {
    const onClick = vi.fn();
    render(<CodexPlanToggle enabled={null} onClick={onClick} busy={false} />);

    const button = screen.getByRole("button", { name: "Plan mode: UNKNOWN" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the current state visible while disabled with a refusal reason", () => {
    const reason = "Codex is working.";
    render(<CodexPlanToggle enabled={false} onClick={vi.fn()} busy={false} disabledReason={reason} />);

    const button = screen.getByRole("button", { name: "Plan mode: OFF" });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute("title", reason);
    expect(button).toHaveAccessibleDescription(reason);
  });

  it("locks the control while switching", () => {
    render(<CodexPlanToggle enabled={true} onClick={vi.fn()} busy />);

    const button = screen.getByRole("button", { name: "Plan mode: SWITCHING…" });
    expect(button).toBeDisabled();
  });
});
