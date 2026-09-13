import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { de } from "@/lib/i18n/messages/de";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const idle = readFileSync(new URL("../src/fixtures/panes/codex--v0154-statusline-single-idle.txt", import.meta.url), "utf8");
const dictionaries = { en, de, zh };
test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["en", "de", "zh"] as const) {
  test(`model presets: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
    const messages = dictionaries[locale];
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((prefs) => {
      localStorage.setItem("collie:theme:v1", prefs.theme);
      localStorage.setItem("collie:locale:v1", prefs.locale);
    }, { theme, locale });
    await installApiStub(page);
    let working = false;
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "codex", status: working ? "working" : "idle" }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: idle, revision: 1, truncated: false,
    } }));
    await page.goto("/pane/w1:p1");
    const entry = page.getByRole("button", { name: /gpt-5\.6-sol/ });
    await entry.click();
    const panel = page.getByRole("dialog");
    const surface = panel.locator("div[tabindex='-1']");
    const choices = panel.getByRole("group", { name: messages["modelPresets.listAria"] }).getByRole("button");
    await expect(panel).toBeVisible();
    await expect(page.getByRole("textbox")).not.toBeFocused();
    await expect(choices).toHaveCount(2);
    await expect(panel.getByText("gpt-6-astra", { exact: true })).toBeVisible();
    await surface.evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished));
    });
    await expect(surface).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath("model-presets.png") });

    await panel.getByRole("button", { name: messages["modelPresets.manage"], exact: true }).click();
    const models = panel.getByRole("textbox", { name: messages["modelPresets.model"], exact: true });
    await expect(models.first()).not.toBeFocused();
    await panel.getByRole("button", { name: messages["modelPresets.add"], exact: true }).click();
    await models.last().fill("private-model-with-a-long-name-for-mobile-layout");
    await panel.getByRole("combobox").last().selectOption("max");
    await panel.getByRole("button", { name: messages["modelPresets.moveUp"], exact: true }).last().click();
    await expect(models.nth(1)).toHaveValue("private-model-with-a-long-name-for-mobile-layout");
    await models.nth(1).blur();
    await expect(surface).toBeInViewport({ ratio: 1 });
    expect(await surface.evaluate((el) => ({
      fits: el.scrollWidth <= el.clientWidth,
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
    }))).toEqual({ fits: true, left: 0, right: width });
    await page.screenshot({ path: testInfo.outputPath("model-presets-editor.png") });
    await panel.getByRole("button", { name: messages["modelPresets.save"], exact: true }).click();
    await expect(choices).toHaveCount(3);
    await page.keyboard.press("Escape");
    working = true;
    await page.reload();
    await entry.click();
    await expect(choices).toHaveCount(3);
    await expect(choices.nth(1)).toContainText("private-model-with-a-long-name-for-mobile-layout");
    for (const option of await choices.all()) await expect(option).toBeDisabled();
    await expect(panel.getByText(messages["modelPresets.idleRequired"], { exact: false })).toBeVisible();
    await expect(panel.getByRole("button", { name: messages["modelPresets.manage"], exact: true })).toBeEnabled();
  });
}
