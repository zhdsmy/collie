import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

// The captured footer, with fields supplied by the new formatter's tested JSON examples.
const pane = readFileSync(new URL("../src/fixtures/panes/claude--custom-statusline.txt", import.meta.url), "utf8")
  .replace("xhigh", "xhigh | Fast:off")
  .replace("34%", "34% | cache warm 85%");
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
    const mode = page.getByRole("button", { name: /Claude mode:.*accept edits on/ });
    await expect(mode).toBeVisible();
    await expect(row.getByRole("img", { name: "Fast:off" })).toBeVisible();
    await expect(row.getByRole("img", { name: "Warm · Cache hit 85%" })).toBeVisible();
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
    const rowBounds = await row.boundingBox();
    const modeBounds = await mode.boundingBox();
    expect(Math.abs(modeBounds!.x - rowBounds!.x)).toBeLessThan(1);
    await expect(page.getByText("new task? /clear to save 600.0k tokens")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`claude-statusline-${theme}.png`) });
    await row.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    const hint = row.getByRole("button", { name: "Claude hint" });
    await expect(hint).toBeInViewport();
    await expect(row.getByText("v2.1.273")).toBeInViewport();
    await hint.click();
    const dialog = page.getByRole("dialog", { name: "Claude hint" });
    await expect(dialog).toHaveText("new task? /clear to save 600.0k tokens");
    await expect(dialog).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath(`claude-statusline-${theme}-scrolled.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
