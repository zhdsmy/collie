import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { claudeSettingsModalScreens } from "@/fixtures/claude-settings";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`Claude Settings share compact Escape cards across tabs: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript((value) => {
      localStorage.setItem("collie:theme:v1", value);
      localStorage.setItem("collie:locale:v1", "en");
    }, theme);
    await installApiStub(page);
    let current = "";
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) =>
      route.fulfill({ json: { paneId: "w1:p1", text: current, truncated: false, revision: 1 } }),
    );

    for (const screen of claudeSettingsModalScreens) {
      current = screen.text;
      await page.goto("/pane/w1:p1");
      await expect(page.getByText(screen.text.split("\n").at(-1)!, { exact: true })).toBeVisible();
      await expect(page.getByRole("group", {
        name: /^(?:Settings\s+Status\s+Config\s+Usage\s+Stats|Auto-compact\s+true|Sep Oct Nov Dec)/,
      })).toHaveCount(0);
      const card = page.getByRole("group", { name: "Collie did not recognize this interface", exact: true });
      await expect(card).toBeVisible();
      await expect(card.locator("pre")).toHaveCount(0);
      const button = card.getByRole("button", { name: "Esc", exact: true });
      const frame = await card.boundingBox();
      const target = await button.boundingBox();
      if (!frame || !target) throw new Error("The compact card and Escape key must be visible");
      expect(frame.height).toBeLessThanOrEqual(50);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const name of ["Return", "Cycle dates", "Copy"]) {
        await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
      }
      await page.screenshot({ path: testInfo.outputPath(`claude-settings-${screen.name}-${theme}.png`) });
    }

    // A real /model capture still uses the existing menu card after native Settings output.
    current += "\n" + readFileSync(new URL("../src/fixtures/panes/claude--menu-model-picker.txt", import.meta.url), "utf8");
    await page.goto("/pane/w1:p1");
    await expect(page.getByRole("group", { name: "Select model", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Set as default", exact: true })).toBeVisible();
  });
}
