import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { coerceDashPrefs } from "@/hooks/use-dash-prefs";
import { createMemoryRouter, RouterProvider } from "react-router";

import { withHeaderHost } from "@/test/header-host";
import { SettingsExperimentsRoute } from "./settings-sections";

// Chat graduated; the local wrap-joining experiment keeps this section visible.

function renderExperiments() {
  const router = createMemoryRouter(
    [
      { path: "/settings/experiments", element: withHeaderHost(<SettingsExperimentsRoute />) },
      { path: "/settings", element: <div data-testid="settings" /> },
    ],
    { initialEntries: ["/settings/experiments"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function stored() {
  const raw = localStorage.getItem("collie:dash-prefs:v1");
  return coerceDashPrefs(raw === null ? undefined : JSON.parse(raw));
}

describe("SettingsExperimentsRoute", () => {
  it("states the section's contract once, above the cards", async () => {
    renderExperiments();
    expect(
      await screen.findByText(
        "Anything here may change, lose settings, or be withdrawn in a patch release.",
      ),
    ).toBeInTheDocument();
  });

  it("holds no Chat switch any more: Chat is the default view", async () => {
    renderExperiments();
    await screen.findByText(/Anything here may change/);
    expect(screen.queryByRole("switch", { name: "Chat" })).toBeNull();
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });
});

describe("SettingsExperimentsRoute — rejoin", () => {
  it("holds rejoining wrapped rows, off, and writes the opt-in", async () => {
    const user = userEvent.setup();
    renderExperiments();
    const toggle = await screen.findByRole("switch", { name: "Rejoin wrapped lines" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(stored().rejoinExperiment).toBe(true);
  });
});
