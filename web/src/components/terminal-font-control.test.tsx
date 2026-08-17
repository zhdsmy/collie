import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { TerminalFontControl } from "./terminal-font-control";

it("offers the three terminal faces and applies the selected one", async () => {
  const user = userEvent.setup();
  render(<TerminalFontControl />);
  const select = screen.getByRole("combobox", { name: "Monospace font" });

  expect([...select.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
    "SF Mono",
    "Geist Mono",
    "JetBrains Mono",
  ]);

  await user.selectOptions(select, "jetbrains-mono");
  expect(select).toHaveValue("jetbrains-mono");
  expect(document.documentElement.dataset.terminalFont).toBe("jetbrains-mono");
});
