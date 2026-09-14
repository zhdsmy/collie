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
const SESSION_KEY = "codex-session-a";
const RECENTS_KEY = `collie:codex-model-recents:v2:${SESSION_KEY}`;

/** Two used pairs, one of which is what the pane is running — so there IS somewhere to switch to. */
const SEEDED = [
  { model: "gpt-5.6-luna", effort: "max" },
  { model: "gpt-5.6-sol", effort: "high" },
];

test.use({ serviceWorkers: "block" });

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}`, import.meta.url), "utf8");

for (const theme of ["light", "dark"]) test(`model switch mask: ${theme}`, async ({ page }, testInfo) => {
  const modelText = fixture("codex--v0154-picker-model.txt");
  const effortText = fixture("codex--v0154-picker-effort.txt");
  let current = pane;
  let revision = 1;
  let releaseModel!: () => void;
  let releaseEffort!: () => void;
  const modelGate = new Promise<void>((resolve) => { releaseModel = resolve; });
  const effortGate = new Promise<void>((resolve) => { releaseEffort = resolve; });
  await page.setViewportSize({ width: theme === "light" ? 390 : 320, height: 844 });
  await page.addInitScript(({ theme: chosenTheme, key }) => {
    localStorage.setItem("collie:theme:v1", chosenTheme);
    localStorage.setItem("collie:locale:v1", "zh");
    if (chosenTheme === "dark") {
      localStorage.setItem("collie:design:v1", JSON.stringify({ font: "geist" }));
      localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ fontFamily: "geist" }));
    }
    localStorage.setItem(key, JSON.stringify([{ model: "gpt-6-astra", effort: "low" }]));
  }, { theme, key: RECENTS_KEY });
  await installApiStub(page);
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? { ...agent, agent: "codex", status: "idle" } : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1", text: current, revision, truncated: false, codexSessionKey: SESSION_KEY,
  } }));
  await page.route("**/api/pane/*/reply*", async (route) => {
    current = route.request().postDataJSON().submit ? modelText
      : fixture("codex--v0154-command-status.txt").replaceAll("/status", "/model");
    revision++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/pane/*/keys*", async (route) => {
    expect(route.request().postDataJSON().keys).toEqual(["Enter"]);
    if (current === modelText) {
      await modelGate;
      current = effortText;
    } else {
      await effortGate;
      current = `${pane}\n• Model changed to gpt-6-astra low.`;
    }
    revision++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/pane/w1:p1");
  const entry = page.getByRole("button", { name: new RegExp(`^${zh["codexModel.openAria"]}:`) });
  const entryBefore = await entry.boundingBox();
  await entry.click();
  await page.getByRole("button", { name: "gpt-6-astra low", exact: true }).click();
  const message = page.getByRole("status").filter({ hasText: "gpt-6-astra · low" });
  const modelTitle = page.getByText("Select Model and Effort", { exact: true });
  await expect(message).toBeVisible();
  await expect(modelTitle).toBeInViewport();
  expect(await modelTitle.evaluate((el) => Boolean(el.closest("[inert]")))).toBe(true);
  await expect.poll(async () => Math.abs(entryBefore!.y - await message.evaluate(
    (el) => el.parentElement!.getBoundingClientRect().bottom,
  ))).toBeLessThanOrEqual(8);
  expect(await entry.boundingBox()).toMatchObject({ y: entryBefore!.y });
  const progressStyle = await message.evaluate((el) => {
    const bar = el.parentElement!;
    const mask = bar.parentElement!;
    return {
      solid: getComputedStyle(bar).backgroundColor === getComputedStyle(document.body).backgroundColor,
      radius: getComputedStyle(bar).borderRadius,
      flushBottom: bar.getBoundingClientRect().bottom === mask.getBoundingClientRect().bottom,
      flushSides: bar.getBoundingClientRect().left === mask.getBoundingClientRect().left
        && bar.getBoundingClientRect().right === mask.getBoundingClientRect().right,
    };
  });
  expect(progressStyle).toEqual({ solid: true, radius: "0px", flushBottom: true, flushSides: true });
  if (theme === "dark") {
    const targetFont = await message.getByText("gpt-6-astra · low", { exact: true }).evaluate((el) => ({
      family: getComputedStyle(el).fontFamily,
      weight: getComputedStyle(el).fontWeight,
    }));
    expect(targetFont.family).toContain("Geist Mono");
    expect(targetFont.weight).toBe("400");
  }
  await page.screenshot({ path: testInfo.outputPath("switch-model-mask.png") });
  releaseModel();
  const effortTitle = page.getByText("Select Reasoning Level for gpt-6-astra", { exact: true });
  await expect(effortTitle).toBeInViewport();
  await expect(message).toBeVisible();
  await expect(page.getByText(zh["codexModel.stage.effort"], { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("switch-effort-mask.png") });
  releaseEffort();
  await expect(message).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole("textbox")).toBeEnabled();
});

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
      paneId: "w1:p1", text: pane, revision: 1, truncated: false, codexSessionKey: SESSION_KEY,
    } }));
    await page.goto("/pane/w1:p1");

    // The model field is a button because the history holds a pair that is not the one on screen.
    const entry = page.getByRole("button", { name: new RegExp(`^${messages["codexModel.openAria"]}:`) });
    const entryBefore = await entry.boundingBox();
    const inputBefore = await page.getByRole("textbox").boundingBox();
    await entry.click();
    const panel = page.getByRole("region", { name: messages["codexModel.recentsAria"] });
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
    }))).toEqual({ fits: true, left: 0, withinViewport: true });
    await page.evaluate(() => Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished)));
    const entryAfter = await entry.boundingBox();
    const inputAfter = await page.getByRole("textbox").boundingBox();
    expect(entryAfter!.y).toBeCloseTo(entryBefore!.y, 0);
    expect(inputAfter!.y).toBeCloseTo(inputBefore!.y, 0);
    const panelBox = await panel.boundingBox();
    expect(panelBox!.width).toBe(width);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(entryAfter!.y);
    expect(await entry.evaluate((el) => getComputedStyle(el).paddingRight)).toBe("0px");
    await page.screenshot({ path: testInfo.outputPath("recent-models.png") });

    // One entry goes on its own, without switching to anything.
    await expect(panel.getByRole("button", { name: messages["codexModel.clearHistory"], exact: true })).toHaveCount(0);
    await panel.getByRole("button", { name: messages["codexModel.manage"], exact: true }).click();
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

    // Empty history still leaves the native model picker reachable.
    await page.keyboard.press("Escape");
    await expect(entry).toHaveCount(1);
    await entry.click();
    const emptyPanel = page.getByRole("region", { name: messages["codexModel.recentsAria"] });
    await expect(emptyPanel.getByText(messages["codexModel.emptyRecents"], { exact: true })).toBeVisible();
    await expect(emptyPanel.getByRole("button", { name: messages["codexModel.native"], exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(page.getByText("gpt-5.6-sol", { exact: true }).first()).toBeVisible();

    // And a history that survives a reload is the whole point of keeping it on the device.
    await page.evaluate(({ key, seeded }) => localStorage.setItem(key, JSON.stringify(seeded)), { key: RECENTS_KEY, seeded: SEEDED });
    working = true;
    await page.reload();
    const reopened = page.getByRole("button", { name: new RegExp(`^${messages["codexModel.openAria"]}:`) });
    await reopened.click();
    const rowsAgain = page.getByRole("region", { name: messages["codexModel.recentsAria"] }).getByRole("button", { name: "gpt-5.6-luna max", exact: true });
    await expect(rowsAgain).toBeVisible();
    // Codex is working: the history can be read and pruned, but nothing may be switched.
    await expect(rowsAgain).toBeDisabled();
    await expect(page.getByRole("region", { name: messages["codexModel.recentsAria"] }).getByRole("button", { name: messages["codexModel.native"], exact: true })).toBeDisabled();
  });
}
