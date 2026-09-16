import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const pane = readFileSync(new URL("../src/fixtures/panes/claude--custom-statusline.txt", import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`Claude custom statusline stays compact and scrollable: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((chosenTheme) => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:theme:v1", chosenTheme);
    }, theme);
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0 ? Object.assign({}, agent, { agent: "claude", status: "idle" }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({
      json: { paneId: "w1:p1", text: pane, truncated: false, revision: 1 },
    }));
    await page.goto("/pane/w1:p1");
    const row = page.locator('[data-slot="claude-statusline"]').filter({ hasText: "example-model[1m]" });
    const ring = row.locator('[data-status-icon="context"]');
    await expect(ring).toHaveAttribute("data-used", "66");
    await expect(page.getByRole("button", { name: /Claude mode:.*accept edits on/ })).toBeVisible();
    await expect(row.getByText("example-model[1m] xhigh")).toHaveCount(1);
    await expect(page.getByText("ctx 34%", { exact: true })).toHaveCount(0);
    const layout = await row.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const context = el.querySelector('[data-status-icon="context"]')!.getBoundingClientRect();
      return { width: el.clientWidth, total: el.scrollWidth, ringTop: context.top - rect.top, ringBottom: rect.bottom - context.bottom };
    });
    expect(layout.total).toBeGreaterThan(layout.width);
    expect(layout.total).toBeLessThan(850);
    expect(layout.ringTop).toBeGreaterThanOrEqual(0);
    expect(layout.ringBottom).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath(`claude-statusline-${theme}.png`) });
    await row.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    const hint = row.getByText("new task? /clear to save 600.0k tokens");
    await expect(hint).toBeInViewport();
    await expect(row.getByText("v2.1.273")).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`claude-statusline-${theme}-scrolled.png`) });
  });
}
