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
