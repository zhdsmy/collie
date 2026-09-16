import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import capture from "@/fixtures/panes/hermes--resume-history.txt?raw";
import startup from "@/fixtures/panes/hermes--startup-resume.txt?raw";
import { AnsiOutput } from "./ansi-output";

describe("Hermes history preview", () => {
  it("shows two summaries, keeps their folds independent, and finds welcome text inside startup", async () => {
    const user = userEvent.setup();
    const text = `${startup}\nVisible reply`;
    const { container, rerender } = render(<AnsiOutput text={text} agent="hermes" />);
    const start = screen.getByRole("button", { name: "Startup information" });
    const history = screen.getByRole("button", { name: "Previous conversation" });
    expect(start).toHaveAccessibleDescription("Hermes v0.21.2 · 25 tools · 86 skills");
    expect(history).toHaveAccessibleDescription("General · 24 user messages");
    expect(screen.queryByText(/Welcome to Hermes/)).toBeNull();
    expect(screen.queryByText(/Resumed session/)).toBeNull();
    await user.click(start);
    const body = await screen.findByRole("region", { name: "Startup information" });
    expect(body.textContent).toContain("Available Tools");
    expect(body.textContent).toContain("Welcome to Hermes");
    expect(body.textContent).toContain("✦ Tip:");
    expect(body.textContent).not.toContain("Resumed session");
    expect(history).toHaveAttribute("aria-expanded", "false");
    await user.click(start);
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
    rerender(<AnsiOutput text={text} agent="hermes" query="/model --global" currentMatch={0} />);
    const searched = await screen.findByRole("region", { name: "Startup information" });
    expect(searched.querySelector('[data-find-match="current"]')?.textContent).toBe("/model --global");
    rerender(<AnsiOutput text={text} agent="hermes" query="Visible reply" currentMatch={0} />);
    expect(container.querySelector('[data-find-match="current"]')?.textContent).toBe("Visible reply");
  });
  it("starts folded, opens without sending keys, and keeps the fold open across polling", async () => {
    const user = userEvent.setup();
    const onPromptAction = vi.fn();
    const { rerender } = render(<AnsiOutput text={capture} agent="hermes" onPromptAction={onPromptAction} />);
    const toggle = screen.getByRole("button", { name: "Previous conversation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toHaveFocus();
    expect(screen.queryByRole("region")).toBeNull();
    await user.click(toggle);
    const body = await screen.findByRole("region", { name: "Previous conversation" });
    expect(body.textContent).toContain("◆ Hermes:");
    expect(onPromptAction).not.toHaveBeenCalled();
    body.scrollTop = 80;
    rerender(<AnsiOutput text={`Older output\n${capture}\nNew output`} agent="hermes" onPromptAction={onPromptAction} />);
    expect(screen.getByRole("button", { name: "Previous conversation" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region").scrollTop).toBe(80);
    await user.click(toggle);
    await waitFor(() => expect(screen.queryByRole("region")).toBeNull());
  });

  it("opens history for find and keeps highlight offsets correct after the card", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const { container, rerender } = render(<AnsiOutput text={`${capture}\nSearch after history`} agent="hermes" />);
    rerender(<AnsiOutput text={`${capture}\nSearch after history`} agent="hermes" query="Hermes" currentMatch={0} />);
    const body = await screen.findByRole("region", { name: "Previous conversation" });
    expect(within(body).getAllByText("Hermes").length).toBeGreaterThan(0);
    await waitFor(() => expect(scroll.mock.instances.some((element) => element instanceof Node && body.contains(element))).toBe(true));
    rerender(<AnsiOutput text={`${capture}\nSearch after history`} agent="hermes" query="Search after history" currentMatch={0} />);
    expect(container.querySelector('[data-find-match="current"]')?.textContent).toBe("Search after history");
    scroll.mockRestore();
  });

  it("keeps repeated panels independent when ordinary output arrives", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error");
    const text = `${capture}\n${capture}`;
    const { rerender } = render(<AnsiOutput text={text} agent="hermes" />);
    await user.click(screen.getAllByRole("button", { name: "Previous conversation" })[1]!);
    rerender(<AnsiOutput text={`Older output\n${text}\nNew output`} agent="hermes" />);
    const toggles = screen.getAllByRole("button", { name: "Previous conversation" });
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "true");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("raw terminal mode preserves the original history panel", () => {
    const { container } = render(<AnsiOutput text={capture} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("pre")?.textContent).toContain("Previous Conversation");
    expect(container.querySelector("pre")?.textContent).toContain("╭");
  });
});
