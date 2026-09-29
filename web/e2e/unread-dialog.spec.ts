import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { installApiStub } from "./fixtures/api";

const SCREEN = readFileSync(
  join(import.meta.dirname, "..", "src", "fixtures", "panes", "claude-lab--menu-status-screen--w82.txt"),
  "utf8",
);
for (const [locale, caption, width] of [
  ["zh", "Collie 未识别此界面", 320],
  ["de", "Collie hat diese Oberfläche nicht erkannt", 320],
  ["ja", "Collie はこのインターフェースを認識しませんでした", 320],
  ["en", "Collie did not recognize this interface", 390],
] as const) {
  test(`one-row card ${locale} ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((l) => localStorage.setItem("collie:locale:v1", l), locale);
    await installApiStub(page);
    await page.route(/\/api\/pane\/w1%3Ap1(?:\?.*)?$/, (route) =>
      route.fulfill({ json: { paneId: "w1:p1", text: SCREEN, truncated: false, revision: 1 } }),
    );
    await page.goto("/pane/w1:p1");
    const card = page.getByRole("group", { name: caption });
    await expect(card).toBeVisible();
    const btn = card.getByRole("button", { name: "Esc" });
    const cb = await card.boundingBox();
    const bb = await btn.boundingBox();
    const cap = await card.getByText(caption).boundingBox();
    if (!cb || !bb || !cap) throw new Error("The card, caption, and key must be visible");
    expect(bb.width).toBeGreaterThanOrEqual(44);
    expect(bb.height).toBeGreaterThanOrEqual(44);
    expect(cb.height).toBeLessThanOrEqual(50);
    // caption and button share a row, nothing spills out of the card
    expect(Math.abs((cap.y + cap.height / 2) - (bb.y + bb.height / 2))).toBeLessThan(8);
    expect(cap.x + cap.width).toBeLessThanOrEqual(bb.x);
    expect(bb.x + bb.width).toBeLessThanOrEqual(cb.x + cb.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`row-${locale}-${width}.png`) });
  });
}
