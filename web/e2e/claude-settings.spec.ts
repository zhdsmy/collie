import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { claudeSettingsScreens } from "@/fixtures/claude-settings";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`Claude Settings stay native across tabs: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => {
      localStorage.setItem("collie:theme:v1", value);
      localStorage.setItem("collie:locale:v1", "en");
    }, theme);
    await installApiStub(page);
    let current = "";
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) =>
      route.fulfill({ json: { paneId: "w1:p1", text: current, truncated: false, revision: 1 } }),
    );

    for (const screen of claudeSettingsScreens) {
      current = screen.text;
      await page.goto("/pane/w1:p1");
      await expect(page.getByText(screen.text.split("\n").at(-1)!, { exact: true })).toBeVisible();
      await expect(page.getByRole("group", {
        name: /^(?:Settings\s+Status\s+Config\s+Usage\s+Stats|Auto-compact\s+true|Sep Oct Nov Dec)/,
      })).toHaveCount(0);
      for (const name of ["Return", "Cycle dates", "Copy"]) {
        await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
      }
      if (screen.name === "Stats") {
        await page.screenshot({ path: testInfo.outputPath(`claude-settings-${theme}.png`), fullPage: true });
      }
    }

    // A real /model capture still uses the existing menu card after native Settings output.
    current += "\n" + readFileSync(new URL("../src/fixtures/panes/claude--menu-model-picker.txt", import.meta.url), "utf8");
    await page.goto("/pane/w1:p1");
    await expect(page.getByRole("group", { name: "Select model", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Set as default", exact: true })).toBeVisible();
  });
}
