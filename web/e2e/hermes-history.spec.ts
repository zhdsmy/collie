import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "../src/test/handlers";
import { en } from "../src/lib/i18n/messages/en";
import { zh } from "../src/lib/i18n/messages/zh";
import { de } from "../src/lib/i18n/messages/de";

const capture = readFileSync(new URL("../src/fixtures/panes/hermes--resume-history.txt", import.meta.url), "utf8");
const done = readFileSync(new URL("../src/fixtures/panes/hermes--done.txt", import.meta.url), "utf8");
const dictionaries = { en, zh, de };
test.use({ serviceWorkers: "block" });

for (const [width, locale, theme] of [[320, "zh", "light"], [390, "en", "dark"], [320, "de", "dark"]] as const) {
  test(`Hermes resumed history: ${width} ${locale} ${theme}`, async ({ page }, testInfo) => {
    const title = dictionaries[locale]["chat.historyPreview.title"];
    const writes: string[] = [];
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:theme:v1", preferences.theme);
      localStorage.setItem("collie:locale:v1", preferences.locale);
    }, { theme, locale });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "hermes", status: "idle", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: `${capture}\n${done}`, truncated: false, revision: 1,
    } }));
    await page.route((url) => /\/api\/pane\/[^/]+\/(keys|reply)$/.test(url.pathname), (route) => {
      writes.push(route.request().url());
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    const toggle = page.getByRole("button", { name: title, exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("region", { name: title })).toHaveCount(0);
    await expect(page.getByRole("textbox").first()).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("history-folded.png") });
    await toggle.click();
    const body = page.getByRole("region", { name: title, exact: true });
    await expect(body).toBeVisible();
    await expect(body.locator("..")).toHaveCSS("overflow", "visible");
    await expect(body).toContainText("◆ Hermes:");
    const geometry = await body.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { height: box.height, left: box.left, right: box.right,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
    });
    expect(geometry.height).toBeLessThanOrEqual(844 * 0.45 + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(width);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
    await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole("textbox").first()).not.toBeFocused();
    expect(writes).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("history-expanded.png"), animations: "disabled" });
    await toggle.click();
    await expect(body).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(() => localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ rawTerminal: true })));
    await page.reload();
    await expect(toggle).toHaveCount(0);
    await expect(page.locator("pre").filter({ hasText: "Previous Conversation" })).toBeVisible();
    expect(writes).toEqual([]);
  });
}
