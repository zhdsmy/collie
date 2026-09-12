import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { claudeDiffSample } from "@/test/claude-diff";

test.use({ serviceWorkers: "block" });

for (const width of [320, 390, 820]) for (const theme of ["light", "dark"]) {
  test(`Claude diff rectangles: ${width} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((selected) => {
      localStorage.setItem("collie:theme:v1", selected);
      localStorage.setItem("collie:locale:v1", "en");
    }, theme);
    await installApiStub(page);
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: claudeDiffSample, revision: 1, truncated: false,
    } }));
    await page.goto("/pane/w1:p1");
    const output = page.getByText("● Update(sample.ts)", { exact: true });
    await expect(output).toBeVisible();
    const geometry = await output.evaluate((el) => {
      const mirror = el.closest("pre")!;
      const bounds = mirror.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, rows: [...mirror.querySelectorAll("[data-terminal-surface]")].map((row) => {
        const box = row.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, color: getComputedStyle(row).backgroundColor };
      }) };
    });
    expect(geometry.rows).toHaveLength(5);
    for (const row of geometry.rows) {
      expect(row.left).toBe(geometry.left);
      expect(row.right).toBe(geometry.right);
      expect(Math.round(row.left)).toBe(Math.round(width - row.right));
    }
    for (let i = 1; i < geometry.rows.length; i++) expect(geometry.rows[i - 1]!.bottom).toBe(geometry.rows[i]!.top);
    expect(geometry.rows.map((row) => row.color)).toEqual([
      "rgb(48, 0, 0)", "rgb(48, 0, 0)", "rgb(48, 0, 0)", "rgb(0, 40, 0)", "rgb(0, 40, 0)",
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath("diff.png") });
    await page.evaluate(() => localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ rawTerminal: true })));
    await page.reload();
    await expect(output).toBeVisible();
    expect(await output.evaluate((el) => el.closest("pre")!.querySelectorAll("[data-terminal-surface]").length)).toBe(0);
  });
}
