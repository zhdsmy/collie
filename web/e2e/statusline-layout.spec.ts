import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { zh } from "@/lib/i18n/messages/zh";
import { installApiStub } from "./fixtures/api";

const pane = readFileSync(new URL("../src/fixtures/panes/codex--v0154-statusline-multiple-muted-default.txt", import.meta.url), "utf8");

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`first-token timing updates in the Codex statusline: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((chosenTheme) => {
      localStorage.setItem("collie:locale:v1", "zh");
      localStorage.setItem("collie:theme:v1", chosenTheme);
    }, theme);
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0 ? { ...agent, agent: "codex", status: "idle" } : agent),
    } }));
    let ms: number | undefined = 4166;
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({
      json: { paneId: "w1:p1", text: pane, truncated: false, revision: 1, lastTurnFirstTokenMs: ms },
    }));
    await page.goto("/pane/w1:p1");
    const timing = page.getByRole("img", { name: "最近完成轮次的首 token 耗时 4.2s" });
    await expect(timing).toBeVisible();
    await timing.scrollIntoViewIfNeeded();
    const fits = await timing.evaluate((el) => {
      const row = el.closest('[data-slot="codex-statusline"]')!;
      const box = el.getBoundingClientRect();
      const clip = row.getBoundingClientRect();
      return box.top >= clip.top && box.bottom <= clip.bottom;
    });
    expect(fits).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("first-token.png") });
    ms = 6200;
    await expect(page.getByRole("img", { name: "最近完成轮次的首 token 耗时 6.2s" })).toBeVisible({ timeout: 15_000 });
    ms = undefined;
    await expect(page.getByRole("img", { name: /最近完成轮次的首 token 耗时/ })).toHaveCount(0, { timeout: 15_000 });
  });
}

for (const theme of ["light", "dark"]) for (const font of ["system", "menlo", "geist"]) {
  test(`statusline glyphs fit with recent models open: ${theme} ${font}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: theme === "light" ? 430 : 320, height: 932 });
    await page.addInitScript(({ fontFamily, theme: chosenTheme }) => {
      localStorage.setItem("collie:locale:v1", "zh");
      localStorage.setItem("collie:theme:v1", chosenTheme);
      localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ fontFamily }));
    }, { fontFamily: font, theme });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0 ? Object.assign({}, agent, { agent: "codex", status: "idle" }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({
      json: { paneId: "w1:p1", text: pane, revision: 1, sessionKey: null, unavailable: false },
    }));
    await page.goto("/pane/w1:p1");
    const model = page.getByRole("button", { name: new RegExp(`^${zh["codexModel.openAria"]}:`) });
    await model.click();
    const panel = page.getByRole("region", { name: zh["codexModel.recentsAria"] });
    await expect(panel).toBeVisible();
    await expect.poll(() => panel.evaluate((el) => el.closest('[data-slot="collapse"]')?.getAttribute("data-state"))).toBe("open");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished)));
    const bounds = await model.evaluate((button) => {
      const row = button.closest('[data-slot="codex-statusline"]')!;
      const text = document.createRange();
      text.selectNodeContents(button.querySelector("span")!);
      const glyphs = text.getBoundingClientRect();
      const clip = row.getBoundingClientRect();
      return { top: glyphs.top - clip.top, bottom: clip.bottom - glyphs.bottom,
        height: row.clientHeight, scrollHeight: row.scrollHeight, scrollTop: row.scrollTop };
    });
    await page.screenshot({ path: testInfo.outputPath("recent-models-layout.png") });
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeGreaterThanOrEqual(0);
    expect(bounds.scrollHeight).toBe(bounds.height);

    const actions = page.locator('[data-slot="composer-actions"]');
    expect(await actions.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      await page.locator('[data-slot="composer"]').evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    const scroller = actions.locator(".overflow-x-auto");
    await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    const last = await scroller.getByRole("button").last().boundingBox();
    const switcher = await page.getByRole("button", { name: zh["chat.switcher.aria"] }).boundingBox();
    expect(last!.x + last!.width).toBeLessThan(switcher!.x);
    await page.screenshot({ path: testInfo.outputPath("actions-scrolled.png") });
  });
}
