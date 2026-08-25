import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodexComposerControls } from "./codex-composer-controls";

describe("CodexComposerControls", () => {
  it("renders one stable-size control per session action and reports confirmed state", () => {
    const onCommand = vi.fn();
    render(
      <CodexComposerControls
        state={{
          model: "gpt-5.6-sol",
          activity: "ready",
          approval: "Approve for me",
          fast: false,
        }}
        busy={null}
        disabled={false}
        onCommand={onCommand}
      />,
    );

    const permissions = screen.getByRole("button", { name: "Permissions: Approve for me" });
    const model = screen.getByRole("button", { name: "Model: gpt-5.6-sol" });
    const fast = screen.getByRole("button", { name: "Fast off" });
    const plan = screen.getByRole("button", { name: "Plan mode" });
    for (const button of [permissions, model, fast, plan]) expect(button).toHaveClass("size-9");
    expect(fast).toHaveAttribute("aria-pressed", "false");
    expect(fast.querySelector("svg")).toHaveAttribute("fill", "none");

    fireEvent.click(model);
    expect(onCommand).toHaveBeenCalledWith("/model");
  });

  it("fills Fast when on and disables controls whose capability is not live", () => {
    render(
      <CodexComposerControls
        state={{ model: "gpt-5.6-terra", activity: "working", fast: true }}
        busy={null}
        disabled={false}
        onCommand={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Fast on" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Fast on" }).querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );
    expect(
      screen.getByRole("button", { name: /Permissions aren't available/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /unavailable while Codex is working/ })).toBeDisabled();
  });
});
