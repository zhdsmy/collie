import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { de } from "@/lib/i18n/messages/de";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

// A pane whose statusline names the model WITH its level (`gpt-5.6-sol · high`), which is the shape
// the menu's "in use" row and the arrow are both judged against.
const pane = readFileSync(new URL("../src/fixtures/panes/codex--v0154-statusline-multiple-muted-default.txt", import.meta.url), "utf8");
const dictionaries = { en, de, zh };
const RECENTS_KEY = "collie:codex-model-recents:v1";

/** Two used pairs, one of which is what the pane is running — so there IS somewhere to switch to. */
const SEEDED = [
  { model: "gpt-5.6-luna", effort: "max" },
  { model: "gpt-5.6-sol", effort: "high" },
];

test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["en", "de", "zh"] as const) {
  test(`recent models: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
    const messages = dictionaries[locale];
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((prefs) => {
      localStorage.setItem("collie:theme:v1", prefs.theme);
      localStorage.setItem("collie:locale:v1", prefs.locale);
      localStorage.setItem(prefs.recentsKey, JSON.stringify(prefs.seeded));
    }, { theme, locale, recentsKey: RECENTS_KEY, seeded: SEEDED });
    await installApiStub(page);
    let working = false;
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "codex", status: working ? "working" : "idle" }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: pane, revision: 1, truncated: false,
    } }));
    await page.goto("/pane/w1:p1");

    // The model field is a button because the history holds a pair that is not the one on screen.
    const entry = page.getByRole("button", { name: /gpt-5\.6-sol/ });
    await entry.click();
    const panel = page.getByRole("dialog");
    const luna = panel.getByRole("button", { name: "gpt-5.6-luna max", exact: true });
    await expect(panel).toBeVisible();
    await expect(page.getByRole("textbox")).not.toBeFocused();

    // Most recently used first — the rows are stacked in that order, and the pane's own pair sits
    // wherever the history put it rather than being lifted out.
    const sol = panel.getByRole("button", { name: "gpt-5.6-sol high", exact: true });
    await expect(luna).toBeVisible();
    await expect(sol).toBeVisible();
    const [lunaBox, solBox] = await Promise.all([luna.boundingBox(), sol.boundingBox()]);
    expect(lunaBox!.y).toBeLessThan(solBox!.y);

    // The panel opens ABOVE the field and stays whole on the narrowest phone — a long model id may
    // not push it off the edge, and a full list may not run off the top.
    await expect(panel).toBeInViewport({ ratio: 1 });
    expect(await panel.evaluate((el) => ({
      fits: el.scrollWidth <= el.clientWidth,
      left: el.getBoundingClientRect().left,
      withinViewport: el.getBoundingClientRect().right <= window.innerWidth,
    }))).toEqual({ fits: true, left: 12, withinViewport: true });
    await page.screenshot({ path: testInfo.outputPath("recent-models.png") });

    // One entry goes on its own, without switching to anything.
    await panel.getByRole("button", {
      name: messages["codexModel.removeAria"].replace("{model}", "gpt-5.6-luna").replace("{effort}", "max"),
      exact: true,
    }).click();
    await expect(luna).toHaveCount(0);
    await expect(sol).toHaveCount(1);
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), RECENTS_KEY))
      .toEqual([{ model: "gpt-5.6-sol", effort: "high" }]);

    // Clearing takes two taps, and the first one only arms.
    const clear = panel.getByRole("button", { name: messages["codexModel.clearHistory"], exact: true });
    await clear.click();
    await expect(panel.getByRole("button", { name: messages["codexModel.clearHistoryConfirm"], exact: true })).toBeVisible();
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), RECENTS_KEY)).toHaveLength(1);
    await panel.getByRole("button", { name: messages["codexModel.clearHistoryConfirm"], exact: true }).click();
    await expect(panel.getByRole("button", { name: messages["codexModel.clearHistory"], exact: true })).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), RECENTS_KEY)).toBe("[]");

    // With an empty history there is nothing to switch to: the field is plain text again.
    await page.keyboard.press("Escape");
    await expect(entry).toHaveCount(0);
    await expect(page.getByText("gpt-5.6-sol", { exact: true }).first()).toBeVisible();

    // And a history that survives a reload is the whole point of keeping it on the device.
    await page.evaluate(({ key, seeded }) => localStorage.setItem(key, JSON.stringify(seeded)), { key: RECENTS_KEY, seeded: SEEDED });
    working = true;
    await page.reload();
    const reopened = page.getByRole("button", { name: /gpt-5\.6-sol/ });
    await reopened.click();
    const rowsAgain = page.getByRole("dialog").getByRole("button", { name: "gpt-5.6-luna max", exact: true });
    await expect(rowsAgain).toBeVisible();
    // Codex is working: the history can be read and pruned, but nothing may be switched.
    await expect(rowsAgain).toBeDisabled();
    await expect(page.getByRole("dialog").getByRole("button", { name: messages["codexModel.native"], exact: true })).toBeDisabled();
  });
}
