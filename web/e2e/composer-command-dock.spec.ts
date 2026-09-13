import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { de } from "@/lib/i18n/messages/de";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";
import { commandsFor } from "@/lib/agent-commands";
import { installApiStub } from "./fixtures/api";

const dictionaries = { en, de, zh };
test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) {
  for (const theme of ["light", "dark"]) {
    for (const locale of ["en", "de", "zh"] as const) {
      test(`command dock: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
        const messages = dictionaries[locale];
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript((preferences) => {
          localStorage.setItem("collie:theme:v1", preferences.theme);
          localStorage.setItem("collie:locale:v1", preferences.locale);
        }, { theme, locale });
        await installApiStub(page);
        await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
          ...fixtureSnapshot,
          agents: fixtureSnapshot.agents.map((agent, index) => index === 0 ? Object.assign({}, agent, { agent: "codex" }) : agent),
        } }));
        await page.goto("/pane/w1:p1");

        const toggle = page.getByRole("button", { name: messages["composer.controls.agent"], exact: true });
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const title = page.getByRole("heading", { name: messages["composer.controls.agent"], exact: true });
        await expect(title).toBeVisible();
        const list = page.getByRole("list", { name: messages["commands.title"] });
        const commands = list.getByRole("button");
        const search = page.getByRole("textbox", { name: messages["commands.search.placeholder"].replace("{count}", String(commandsFor("codex").length)) });
        await expect(search).not.toBeFocused();
        await expect(commands.nth(0)).toBeInViewport();
        await expect(commands.nth(2)).toBeInViewport();
        await expect(commands.nth(3)).not.toBeInViewport();
        await commands.last().scrollIntoViewIfNeeded();
        await expect(search).toBeInViewport();
        await expect(title).toBeInViewport();

        await search.fill("mcp");
        await expect(commands).toHaveCount(1);
        await expect(list.getByText("/mcp", { exact: true })).toBeInViewport();
        await search.fill("no-such-command");
        await expect(commands).toHaveCount(0);
        await expect(search).toBeInViewport();
        await search.clear();
        await expect(commands.first()).toBeInViewport();
        await search.blur();
        if (locale === "zh") {
          await page.screenshot({ path: testInfo.outputPath("agent-dock.png"), fullPage: true });
          if (width === 390) {
            await page.setViewportSize({ width, height: 520 });
            await expect(search).toBeInViewport();
            await expect(toggle).toBeInViewport();
            await page.setViewportSize({ width, height: 844 });
          }
        }

        await page.getByRole("button", { name: messages["composer.controls.quick"], exact: true }).click();
        await expect(list).toHaveCount(0);
        await expect(page.getByRole("heading", { name: messages["composer.controls.quick"], exact: true })).toBeVisible();
        await page.getByRole("button", { name: messages["composer.controls.displayAria"], exact: true }).click();
        await expect(page.getByRole("heading", { name: messages["composer.controls.display"], exact: true })).toBeVisible();
        await toggle.click();
        await expect(search).toHaveValue("");
        await search.fill("mention");
        await list.getByRole("button", { name: /\/mention/ }).click();
        await expect(list).toHaveCount(0);
        await expect(page.getByRole("textbox")).toHaveValue("/mention ");
        await expect(page.getByRole("textbox")).toBeFocused();
      });
    }
  }
}
