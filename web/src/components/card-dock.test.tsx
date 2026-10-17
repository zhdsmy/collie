import { act, fireEvent, render, screen } from "@testing-library/react";
import modelScreen from "@/fixtures/panes/codex--v0158-picker-model.txt?raw";
import { parseAnsi } from "@/lib/ansi";
import { splitLines } from "@/lib/blocks";
import { buildBlocks } from "@/lib/harness";
import { markLive, markSavedCopy, resetLiveness } from "@/lib/liveness";
import { CardDock } from "./card-dock";

afterEach(resetLiveness);

it("allows a picker action only after this pane reads live, and locks saved copies", () => {
  const onPickerAction = vi.fn();
  const props = {
    blocks: buildBlocks(splitLines(parseAnsi(modelScreen)), { agent: "codex" }),
    paneId: "w1:p1",
    onPickerAction,
  };
  const { rerender } = render(<CardDock {...props} />);
  const option = screen.getByRole("button", { name: /GPT-6-Luna/ });
  expect(option).toBeDisabled();
  fireEvent.click(option);
  expect(onPickerAction).not.toHaveBeenCalled();

  act(() => markLive("w1:p2"));
  expect(option).toBeDisabled();
  act(() => markLive("w1:p1"));
  expect(option).toBeEnabled();
  fireEvent.click(option);
  expect(onPickerAction).toHaveBeenCalledTimes(1);

  rerender(<CardDock {...props} stale />);
  expect(option).toBeDisabled();
  rerender(<CardDock {...props} />);
  act(() => markSavedCopy("w1:p1"));
  expect(option).toBeDisabled();
  expect(onPickerAction).toHaveBeenCalledTimes(1);
});


import { hasDialogCard } from "@/components/card-dock";
import { claudeBuildBlocks } from "@/lib/harness/claude";
import { fixtureRows } from "@/test/surface-corpus";

// The composer offers "Answer the dialog" on a refusal only when the dock shows a dialog card (the
// 2026-10-16 field case: an unreadable screen with no card offered a way to nothing).
describe("hasDialogCard", () => {
  const blocks = (name: string) => claudeBuildBlocks(fixtureRows(name));

  it("is true on a screen whose dialog a grammar lifts", () => {
    expect(hasDialogCard(blocks("claude--menu-model-picker.txt"))).toBe(true);
  });

  it("is false on a free box with the agents panel under it, and on a completion popup, which answers nothing", () => {
    expect(hasDialogCard(blocks("claude--v2301-synth-agents-panel-walk-fails.txt"))).toBe(false);
    const popup = blocks("claude--autocomplete-slash-short.txt");
    expect(popup.some((block) => block.kind === "autocomplete")).toBe(true);
    expect(hasDialogCard(popup)).toBe(false);
    expect(hasDialogCard([])).toBe(false);
  });
});
