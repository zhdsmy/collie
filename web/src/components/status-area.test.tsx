import { act, render, screen } from "@testing-library/react";

import { clearStatus, setStatus } from "@/lib/status";
import { StatusArea } from "./status-area";

describe("StatusArea", () => {
  beforeEach(() => clearStatus());
  afterEach(() => clearStatus());

  it("wraps a long persistent error instead of truncating it", () => {
    const message =
      "The agent's input box isn't on screen — a menu or dialog is probably up. Nothing was typed. Tap Send again to type anyway.";
    act(() => setStatus(message, "error"));

    render(<StatusArea />);

    const text = screen.getByText(message);
    expect(text).toHaveClass("whitespace-normal", "break-words", "text-left");
    expect(text).not.toHaveClass("truncate");
  });
});
