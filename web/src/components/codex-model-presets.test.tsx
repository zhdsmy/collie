import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodexModelPresetsSheet } from "./codex-model-presets";
import {
  __resetCodexModelPresets,
  CODEX_MODEL_PRESETS_STORAGE_KEY,
} from "@/lib/codex-model-presets";

beforeEach(() => {
  localStorage.clear();
  __resetCodexModelPresets();
});

describe("CodexModelPresetsSheet", () => {
  it("shows saved combinations and marks the exact current combination", () => {
    render(
      <CodexModelPresetsSheet
        open
        onClose={vi.fn()}
        current={{ model: "gpt-5.6-luna", effort: "max" }}
        onSelect={vi.fn()}
      />,
    );

    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("gpt-6-astra")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /gpt-5\.6-luna/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("edits a preset and rejects a model containing whitespace", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      CODEX_MODEL_PRESETS_STORAGE_KEY,
      JSON.stringify([
        { id: "gpt-6-astra-xhigh", model: "gpt-6-astra", effort: "xhigh" },
        { id: "gpt-5.6-luna-max", model: "gpt-5.6-luna", effort: "max" },
      ]),
    );
    render(<CodexModelPresetsSheet open onClose={vi.fn()} />);
    const panel = screen.getByRole("dialog");
    const modelInput = within(panel).getAllByRole("textbox")[0]!;

    await user.clear(modelInput);
    await user.type(modelInput, "bad model");
    await user.click(within(panel).getByRole("button", { name: /save presets/i }));

    expect(within(panel).getByRole("alert")).toHaveTextContent(/without spaces/i);
    expect(JSON.parse(localStorage.getItem(CODEX_MODEL_PRESETS_STORAGE_KEY)!)).toHaveLength(2);
  });

  it("says a switch is running without also claiming it is refused", () => {
    const props = { open: true, onClose: vi.fn(), onSelect: vi.fn() };
    const { rerender } = render(
      <CodexModelPresetsSheet {...props} busy disabledReason="a dialog is open" />,
    );

    const panel = screen.getByRole("dialog");
    expect(within(panel).getByRole("status")).toHaveTextContent("Switching…");
    expect(within(panel).getByRole("status")).not.toHaveTextContent("a dialog is open");

    rerender(<CodexModelPresetsSheet {...props} disabledReason="a dialog is open" />);
    expect(within(panel).getByRole("status")).toHaveTextContent(
      "Switching is unavailable: a dialog is open",
    );
  });

  it("selects a saved preset without changing the stored list", () => {
    const onSelect = vi.fn();
    render(
      <CodexModelPresetsSheet
        open
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );
    const panel = screen.getByRole("dialog");

    fireEvent.click(within(panel).getByRole("button", { name: /gpt-6-astra/ }));

    expect(onSelect).toHaveBeenCalledWith({
      id: "gpt-6-astra-xhigh",
      model: "gpt-6-astra",
      effort: "xhigh",
    });
  });
});
