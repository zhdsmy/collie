import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const idle = readFileSync(new URL("../src/fixtures/panes/agy--v144-idle--w50.txt", import.meta.url), "utf8");
const working = readFileSync(new URL("../src/fixtures/panes/agy--v144-working--w119.txt", import.meta.url), "utf8");

test.use({ serviceWorkers: "block" });
for (const width of [320, 390]) {
  test(`AGY status fields and working composer: ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "zh");
      localStorage.setItem("collie:theme:v1", "dark");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    let text = idle;
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "agy", status: text === working ? "working" : "idle", hasSession: false }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1,
    } }));

    for (const state of ["idle", "working"] as const) {
      if (state === "working") text = working;
      await page.goto("/pane/w1:p1");
      const strip = page.locator('[data-slot="agy-statusline"]');
      await expect(strip).toHaveCount(1);
      const hint = strip.getByText(state === "idle" ? "? for shortcuts" : "esc to cancel", { exact: true });
      const model = strip.getByText("Gemini 4 Argon · medium", { exact: true });
      await expect(hint).toBeVisible();
      await expect(model).toBeVisible();
      const hintBox = await hint.boundingBox();
      const modelBox = await model.boundingBox();
      expect(modelBox!.x).toBeGreaterThan(hintBox!.x + hintBox!.width);
      await expect(page.getByText("Collie 未识别此界面", { exact: false })).toHaveCount(0);
      const input = page.getByRole("textbox").first();
      await expect(input).toBeEnabled();
      const stripBox = await strip.boundingBox();
      const inputBox = await input.boundingBox();
      expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(inputBox!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: testInfo.outputPath(`agy-${state}.png`) });
    }
  });
}
