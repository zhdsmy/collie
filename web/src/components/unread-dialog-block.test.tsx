import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { parseAnsi } from "@/lib/ansi";
import { splitLines } from "@/lib/blocks";
import { buildBlocks } from "@/lib/harness";
import { ARM_MS, UnreadDialogBlock } from "./unread-dialog-block";
import { claudeSettingsModalScreens } from "@/fixtures/claude-settings";

// The unread-dialog card (.adr/0053). Driven off a real capture through the real pipeline, so what
// it renders is exactly what the post-pass produces.

const SCREEN = readFileSync(
  join(import.meta.dirname, "..", "fixtures", "panes", "claude-lab--menu-status-screen--w82.txt"),
  "utf8",
);

function cardBlock() {
  const block = buildBlocks(splitLines(parseAnsi(SCREEN)), { agent: "claude" }).find(
    (b) => b.kind === "unread-dialog",
  );
  if (!block || block.kind !== "unread-dialog") throw new Error("the fixture produced no card");
  return block;
}

function renderCard(onAction = vi.fn(), disabled = false) {
  const block = cardBlock();
  const { container } = render(
    <UnreadDialogBlock
      cancel={block.cancel}
      lines={block.lines}
      onAction={onAction}
      disabled={disabled}
    />,
  );
  return { onAction, container, block };
}

describe("UnreadDialogBlock", () => {
  it("renders identified native content inside the card and uses the same Escape action", async () => {
    const block = buildBlocks(splitLines(parseAnsi(claudeSettingsModalScreens[0].text)), { agent: "claude" })[0];
    if (block?.kind !== "unread-dialog") throw new Error("Expected the settings card");
    const onAction = vi.fn();
    const { container } = render(<UnreadDialogBlock cancel={block.cancel} lines={block.lines} viewport={block.viewport} onAction={onAction} />);
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(container.querySelector("pre")).toHaveTextContent("Version: 2.1.284");
    expect(container.querySelector("pre")).toHaveAttribute("tabindex", "0");
    expect(screen.queryByText("Collie did not recognize this interface")).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tap again to send Esc" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("Escape");
  });

  it("carries the screen when no mirror is drawn, and the Warnings footer arms Dismiss", async () => {
    // Codex 0.160.1's Warnings panel, a real capture: in Chat the card is the only place it shows.
    const panel = readFileSync(
      join(import.meta.dirname, "..", "fixtures", "panes", "codex--v0160-warnings-panel.txt"),
      "utf8",
    );
    const block = buildBlocks(splitLines(parseAnsi(panel)), { agent: "codex" }).find((b) => b.kind === "unread-dialog");
    if (block?.kind !== "unread-dialog") throw new Error("the Warnings panel produced no card");
    const onAction = vi.fn();
    const { container, rerender } = render(
      <UnreadDialogBlock cancel={block.cancel} lines={block.lines} onAction={onAction} />,
    );
    // Terminal body: the mirror shows the rows, so the card stays the compact caption and key.
    expect(container.querySelector("pre")).toBeNull();
    rerender(<UnreadDialogBlock cancel={block.cancel} lines={block.lines} onAction={onAction} screen={block.lines} />);
    expect(container.querySelector("pre")).toHaveTextContent("Warnings · 1 of 1 · MCP · collie_canary");
    expect(container.querySelector("pre")).toHaveTextContent("esc dismiss & close");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tap again to dismiss" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("Escape");
  });

  it("renders the caption and exactly one control: the declared key", () => {
    renderCard();
    expect(screen.getByText("Collie did not recognize this interface")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // The key, named the way the Keys keypad names it — and NEVER a verb: on Muse this key steps
    // back rather than dismisses, so a label promising "cancel" would be a lie on a real harness.
    expect(screen.getByRole("button", { name: "Esc" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });

  // Downstream: the mirror above draws the screen, so the card carries no copy of it.
  it("does not mirror the screen inside the card", () => {
    const { container } = renderCard();
    expect(container.querySelector("pre")).toBeNull();
  });

  it.each(["screen", "viewport"])("wraps or pans the %s mirror by the device's Wrap lines", (kind) => {
    const block = cardBlock();
    const props = {
      cancel: block.cancel, lines: block.lines, onAction: vi.fn(),
      ...(kind === "screen" ? { screen: block.lines } : { viewport: { title: "Status", lines: block.lines } }),
    };
    const { container, rerender } = render(<UnreadDialogBlock {...props} wrap />);
    expect(container.querySelector("pre")!.className).toContain("whitespace-pre-wrap");

    rerender(<UnreadDialogBlock {...props} wrap={false} />);
    expect(container.querySelector("pre")!.className).toContain("overflow-auto");
    expect(container.querySelector("pre")!.className).not.toContain("whitespace-pre-wrap");
  });

  // #339: the first tap arms, the second sends. An Escape over a screen nobody read can end a
  // question turn, so one stray tap must never do it.
  it("arms on the first tap and sends nothing", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard();
    await user.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tap again to send Esc" })).toBeInTheDocument();
  });

  it("sends the declared key on the second tap, once", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard();
    await user.click(screen.getByRole("button", { name: "Esc" }));
    await user.click(screen.getByRole("button", { name: "Tap again to send Esc" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("Escape");
    expect(screen.getByRole("button", { name: "Esc" })).toBeInTheDocument();
  });

  it("disarms after the timeout, so the next tap arms again", () => {
    vi.useFakeTimers();
    try {
      const { onAction } = renderCard();
      fireEvent.click(screen.getByRole("button", { name: "Esc" }));
      expect(screen.getByRole("button", { name: "Tap again to send Esc" })).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(ARM_MS + 1);
      });
      expect(screen.getByRole("button", { name: "Esc" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Esc" }));
      expect(onAction).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("disarms when the card is disabled", () => {
    const block = cardBlock();
    const props = { cancel: block.cancel, lines: block.lines, onAction: vi.fn() };
    const { rerender } = render(<UnreadDialogBlock {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    rerender(<UnreadDialogBlock {...props} disabled />);
    rerender(<UnreadDialogBlock {...props} />);
    expect(screen.getByRole("button", { name: "Esc" })).toBeInTheDocument();
  });

  it("says Dismiss on a screen whose footer prints `esc dismiss` (opencode question)", async () => {
    const user = userEvent.setup();
    const text = readFileSync(
      join(import.meta.dirname, "..", "fixtures", "panes", "oc--question--tall14.txt"),
      "utf8",
    );
    const block = buildBlocks(splitLines(parseAnsi(text)), { agent: "opencode" }).find(
      (b) => b.kind === "unread-dialog",
    );
    if (!block || block.kind !== "unread-dialog") throw new Error("no card");
    const onAction = vi.fn();
    render(<UnreadDialogBlock cancel={block.cancel} lines={block.lines} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tap again to dismiss" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("Escape");
  });

  it("resets the arm when the dialog changes, so a tap on the new dialog only arms", () => {
    const block = cardBlock();
    const onAction = vi.fn();
    const props = { cancel: block.cancel, onAction };
    const { rerender } = render(<UnreadDialogBlock {...props} lines={block.lines} />);
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    expect(screen.getByRole("button", { name: "Tap again to send Esc" })).toBeInTheDocument();
    rerender(<UnreadDialogBlock {...props} lines={block.lines.slice(1)} />);
    expect(screen.getByRole("button", { name: "Esc" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tap again to send Esc" })).toBeInTheDocument();
  });

  it("resets the arm when the declared key changes", () => {
    const block = cardBlock();
    const onAction = vi.fn();
    const { rerender } = render(
      <UnreadDialogBlock cancel={block.cancel} lines={block.lines} onAction={onAction} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    rerender(
      <UnreadDialogBlock
        cancel={{ ...block.cancel, key: "Enter" }}
        lines={block.lines}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(screen.getByRole("button", { name: "Tap again to send ⏎" })).toHaveTextContent("⏎");
    expect(onAction).not.toHaveBeenCalled();
  });

  it("keeps the arm when a refresh brings the same rows", () => {
    const block = cardBlock();
    const onAction = vi.fn();
    const { rerender } = render(
      <UnreadDialogBlock cancel={block.cancel} lines={block.lines} onAction={onAction} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    rerender(
      <UnreadDialogBlock cancel={{ ...block.cancel }} lines={[...block.lines]} onAction={onAction} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tap again to send Esc" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("Escape");
  });

  it("uses the key wording, not Dismiss, when no row prints `esc dismiss`", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    expect(screen.getByRole("button", { name: "Tap again to send Esc" })).toBeInTheDocument();
    expect(screen.queryByText("Tap again to dismiss")).toBeNull();
  });

  it("announces the armed wording in a status region", () => {
    renderCard();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Esc" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tap again to send Esc");
  });

  it("presses nothing while disabled", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard(vi.fn(), true);
    await user.click(screen.getByRole("button", { name: "Esc" }));
    await user.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).not.toHaveBeenCalled();
  });

  // DESIGN.md §2: a state may repaint, it may not re-lay-out. The in-flight state recolours the
  // button and nothing else — same text, same children, same reserved border — so the card the
  // operator is reading does not shift under the tap.
  it("does not move content when the tap goes in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => (release = resolve));
    const { container } = renderCard(vi.fn().mockReturnValue(pending));
    const button = screen.getByRole("button", { name: "Esc" });

    const before = {
      text: container.textContent,
      children: button.childNodes.length,
      classes: button.className.split(" ").filter((c) => c.startsWith("min-h") || c === "border")
        .length,
    };

    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Tap again to send Esc" }));
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.textContent).toBe(before.text);
    expect(button.childNodes.length).toBe(before.children);
    // The tap floor and the reserved edge survive the state (DESIGN.md §6 and §2).
    expect(
      button.className.split(" ").filter((c) => c.startsWith("min-h") || c === "border").length,
    ).toBe(before.classes);

    release();
  });
});
