import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot, paneTextWithDraft } from "../src/test/handlers";
import { en } from "../src/lib/i18n/messages/en";
import { zh } from "../src/lib/i18n/messages/zh";

const frame = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}.txt`, import.meta.url), "utf8");
const initial = frame("codex--resume-picker");
const moved = frame("codex--resume-picker-moved");
test.use({ serviceWorkers: "block" });

for (const [locale, theme, action, finalKey] of [["zh", "light", "Resume", "Enter"], ["en", "dark", "Exit", "Escape"]] as const) {
  test(`Shared Resume menu: 320px ${locale} ${theme} ${action}`, async ({ page }, testInfo) => {
    const messages = locale === "zh" ? zh : en;
    let text = initial;
    const keys: string[][] = [];
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:theme:v1", preferences.theme);
      localStorage.setItem("collie:locale:v1", preferences.locale);
    }, { theme, locale });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "codex", status: "idle", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
      (route) => route.fulfill({ json: { paneId: "w1:p1", text, truncated: false, revision: keys.length + 1 } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: the app's own key request is checked before advancing this native-screen stub.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
      expect(body.expected_prompt).toContain("Resume a previous session");
      expect(body.keys).toEqual(keys.length === 0 ? ["Down"] : [finalKey]);
      keys.push(body.keys);
      text = keys.length === 1 ? moved : paneTextWithDraft();
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto("/pane/w1:p1");
    const panel = page.getByRole("group", { name: "Resume a previous session", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button", { name: messages["dialog.menu.moveUp"], exact: true })).toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`resume-${locale}-${theme}.png`), fullPage: true });
    await panel.getByRole("button", { name: messages["dialog.menu.moveDown"], exact: true }).click();
    await expect.poll(() => keys.length).toBe(1);
    await panel.getByRole("button", { name: action, exact: true }).click();
    await expect(panel).toHaveCount(0);
    expect(keys).toEqual([["Down"], [finalKey]]);
  });
}
