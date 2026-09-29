import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { claudeSettingsModalScreens } from "@/fixtures/claude-settings";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

for (const [theme, width] of [["light", 320], ["dark", 320], ["light", 1280]] as const) {
  test(`Claude Settings share fixed scrolling cards across tabs: ${theme} ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
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
      if (screen.name === "Status") {
        const rows = screen.text.split("\n");
        rows[0] = "▔".repeat(320);
        rows.splice(rows.length - 1, 0, ...Array.from({ length: 30 }, (_, i) =>
          `Field ${i}: ${"Synthetic status value ".repeat(12)}`));
        current = rows.join("\n");
      }
      await page.goto("/pane/w1:p1");
      await expect(page.getByText(screen.text.split("\n").at(-1)!, { exact: true })).toBeVisible();
      await expect(page.getByRole("group", {
        name: /^(?:Settings\s+Status\s+Config\s+Usage\s+Stats|Auto-compact\s+true|Sep Oct Nov Dec)/,
      })).toHaveCount(0);
      const title = screen.name === "Stats loading" ? "Stats" : screen.name;
      const card = page.getByRole("group", { name: title, exact: true });
      await expect(card).toBeVisible();
      const body = card.locator("pre");
      await expect(body).toHaveCount(1);
      await expect(page.getByText("Version: 2.1.284", { exact: true })).toHaveCount(screen.name === "Status" ? 1 : 0);
      const button = card.getByRole("button", { name: "Esc", exact: true });
      const frame = await card.boundingBox();
      const target = await button.boundingBox();
      if (!frame || !target) throw new Error("The card and Escape key must be visible");
      expect(frame.height).toBe(320);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(target.width).toBeGreaterThanOrEqual(44);
      const keycap = await button.locator("span").boundingBox();
      expect(keycap!.height).toBeLessThan(28);
      expect(keycap!.width).toBeLessThan(40);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (screen.name === "Status") {
        const overflow = await body.evaluate((node) => ({
          x: node.scrollWidth > node.clientWidth,
          y: node.scrollHeight > node.clientHeight,
        }));
        expect(overflow).toEqual({ x: true, y: true });
        await body.evaluate((node) => { node.scrollLeft = 100; node.scrollTop = 100; });
        expect(await body.evaluate((node) => ({ x: node.scrollLeft, y: node.scrollTop }))).toEqual({ x: 100, y: 100 });
        expect(await button.boundingBox()).toEqual(target);
        expect(await card.boundingBox()).toEqual(frame);
        await body.evaluate((node) => { node.scrollLeft = 0; node.scrollTop = 0; });
      }
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
