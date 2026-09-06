import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VisualThemeControl } from "@/components/visual-theme-control";
import { __resetDesign, DESIGN_STORAGE_KEY } from "@/lib/design";

// The published ESM bundle carries a Drawer-local react-dom path that Node's
// Vitest resolver cannot satisfy. Production Vite resolves the package normally;
// this focused interaction test only needs the public control contracts.
vi.mock("animal-island-ui", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Icon: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <span {...props}>{children}</span>,
}));

describe("VisualThemeControl", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    __resetDesign();
  });

  it("switches into Animal Island and back without changing color-scheme state", async () => {
    localStorage.setItem("collie:theme:v1", "dark");
    document.documentElement.classList.add("dark", "app-viewport-locked");
    const user = userEvent.setup();
    render(<VisualThemeControl />);

    await user.click(screen.getByRole("button", { name: "Use Animal Island" }));
    expect(document.documentElement).toHaveClass("theme-island", "dark", "app-viewport-locked");
    expect(JSON.parse(localStorage.getItem(DESIGN_STORAGE_KEY)!)).toMatchObject({
      font: "aldrich",
      theme: "animal-island",
    });
    expect(screen.getByRole("button", { name: "Use classic Collie" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Use classic Collie" }));
    expect(document.documentElement).not.toHaveClass("theme-island");
    expect(document.documentElement).toHaveClass("dark", "app-viewport-locked");
    expect(JSON.parse(localStorage.getItem(DESIGN_STORAGE_KEY)!)).toEqual({ font: "aldrich" });
  });
});
