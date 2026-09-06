import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { clearStatus, setStatus } from "@/lib/status";
import { HeaderStatus } from "./header-status";

// The pane screen's title slot: while a status is live it replaces `children` in place; when it
// clears, `children` comes back. Driven with fake timers the same way lib/status.test.ts drives the
// channel itself — this file only checks the SWAP, not the channel's own TTL/latest-wins rules.
describe("HeaderStatus — swaps the title for a live status, in place", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearStatus();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the title when there is no status", () => {
    render(
      <HeaderStatus>
        <span>webapp › main</span>
      </HeaderStatus>,
    );
    expect(screen.getByText("webapp › main")).toBeInTheDocument();
  });

  it("replaces the title with the status text, announced, while one is live", () => {
    render(
      <HeaderStatus>
        <span>webapp › main</span>
      </HeaderStatus>,
    );
    act(() => setStatus("Sent", "success"));
    expect(screen.queryByText("webapp › main")).not.toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Sent");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("brings the title back once the status auto-clears", () => {
    render(
      <HeaderStatus>
        <span>webapp › main</span>
      </HeaderStatus>,
    );
    act(() => setStatus("Sent", "success"));
    expect(screen.getByRole("status")).toHaveTextContent("Sent");
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("webapp › main")).toBeInTheDocument();
  });

  it("keeps errors until explicitly dismissed from their details", () => {
    render(
      <HeaderStatus>
        <span>webapp › main</span>
      </HeaderStatus>,
    );
    act(() => setStatus("send failed", "error"));
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByRole("status")).toHaveTextContent("send failed");
    fireEvent.click(screen.getByRole("button", { name: "Error details" }));
    const dialog = screen.getByRole("dialog", { name: "Error details" });
    expect(dialog).toHaveTextContent("send failed");
    fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("webapp › main")).toBeInTheDocument();
  });

  it("opens complete multiline errors outside the clipped header and preserves them when details close", () => {
    const { container } = render(<HeaderStatus><span>webapp</span></HeaderStatus>);
    const message = `Could not verify the terminal input.\n${"A long error detail. ".repeat(30)}\nNothing was submitted.`;
    act(() => setStatus(message, "error"));
    const trigger = screen.getByRole("button", { name: "Error details" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Error details" });
    const detail = dialog.querySelector('[data-slot="status-details-text"]')!;
    expect(detail.textContent).toBe(message);
    expect(detail).toHaveClass("whitespace-pre-wrap", "break-words", "select-text");
    expect(detail).not.toHaveClass("truncate");
    expect(container).not.toContainElement(dialog);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toBe(message);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("does not leave old details open when a newer status replaces an error", () => {
    render(<HeaderStatus><span>webapp</span></HeaderStatus>);
    act(() => setStatus("First failure", "error"));
    fireEvent.click(screen.getByRole("button", { name: "Error details" }));
    act(() => setStatus("Second failure", "error"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Second failure");
    fireEvent.click(screen.getByRole("button", { name: "Error details" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Second failure");
    act(() => setStatus("Sent", "success"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Error details" })).not.toBeInTheDocument();
  });
});
