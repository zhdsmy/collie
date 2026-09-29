import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { parseAnsi } from "@/lib/ansi";
import { splitLines } from "@/lib/blocks";
import { buildBlocks } from "@/lib/harness";
import { UnreadDialogBlock } from "./unread-dialog-block";
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
    const { container } = render(<UnreadDialogBlock cancel={block.cancel} viewport={block.viewport} onAction={onAction} />);
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
    expect(container.querySelector("pre")).toHaveTextContent("Version: 2.1.284");
    expect(container.querySelector("pre")).toHaveAttribute("tabindex", "0");
    expect(screen.queryByText("Collie did not recognize this interface")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Esc" }));
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

  it("fires the declared key on a tap", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard();
    await user.click(screen.getByRole("button", { name: "Esc" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith("Escape");
  });

  it("presses nothing while disabled", async () => {
    const user = userEvent.setup();
    const { onAction } = renderCard(vi.fn(), true);
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
