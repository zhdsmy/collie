import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot, paneTextWithDraft } from "../src/test/handlers";
import { en } from "../src/lib/i18n/messages/en";
import { zh } from "../src/lib/i18n/messages/zh";
import { de } from "../src/lib/i18n/messages/de";

const fixture = (state: string) => readFileSync(new URL(
  `../src/fixtures/panes/codex--v0154-resume-${state}.txt`, import.meta.url,
), "utf8");
const dictionaries = { en, zh, de };
test.use({ serviceWorkers: "block" });

for (const [width, locale, theme] of [[320, "zh", "light"], [390, "en", "dark"], [320, "de", "dark"]] as const) {
  test(`Saved sessions: ${width} ${locale} ${theme}`, async ({ page }, testInfo) => {
    const messages = dictionaries[locale];
    let state = "list";
    const keys: string[][] = [];
    await page.setViewportSize({ width, height: 844 });
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
      (route) => route.fulfill({ json: { paneId: "w1:p1", text: state === "done" ? paneTextWithDraft() : state === "list"
        ? fixture(state).replace("Explain how the fixture grammar decides a picked row", "Refactor the picker row formatter into three small helpers")
        : fixture(state), truncated: false, revision: 1 } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/reply", (route) => {
      // SAFETY: this is the app's search payload; assert the native text and binding before advancing.
      const body = route.request().postDataJSON() as { text: string; submit: boolean; expected_prompt?: string };
      expect(body).toMatchObject({ text: "picker", submit: false });
      expect(body.expected_prompt).toContain("Resume a previous session");
      state = "search";
      return route.fulfill({ json: { ok: true } });
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: resume only the pointed search result; no inferred digits or unbound keys are accepted.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
      expect(state).toBe("search");
      expect(body.keys).toEqual(["Enter"]);
      expect(body.expected_prompt).toContain("Search: picker");
      keys.push(body.keys);
      state = "done";
      return route.fulfill({ json: { ok: true } });
    });

    await page.goto("/pane/w1:p1");
    const panel = page.getByRole("group", { name: messages["dialog.sessions.title"], exact: true });
    await expect(panel).toBeVisible();
    const search = panel.getByRole("searchbox", { name: messages["dialog.sessions.search"] });
    await expect(search).not.toBeFocused();
    await expect(panel.locator('[data-slot="session-options"] button')).toHaveCount(4);
    await expect(panel.getByRole("button", {
      name: "Refactor the picker row formatter into three small helpers", exact: true,
    })).toHaveCount(2);
    await expect(panel.locator("details")).not.toHaveAttribute("open", "");
    await expect(panel.locator('[data-slot="picker-footer"]')).not.toBeVisible();
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await panel.locator('[data-slot="session-title"]').evaluateAll((elements) => elements.every((element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().height <= parseFloat(style.lineHeight) * 2 + 1;
    }))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`resume-${locale}-${theme}.png`), fullPage: true });
    await panel.locator("summary").click();
    await expect(panel.locator('[data-slot="picker-footer"]')).toBeVisible();
    await panel.locator("summary").click();
    await search.fill("picker");
    await panel.getByRole("button", { name: messages["dialog.sessions.searchAction"], exact: true }).click();
    await expect(panel.locator('[data-slot="session-options"] button')).toHaveCount(1);
    expect(keys).toEqual([]);
    await panel.getByRole("button", { name: "Refactor the picker row formatter into three small helpers", exact: true }).click();
    await expect(panel).toHaveCount(0);
    expect(keys).toEqual([["Enter"]]);
  });
}
