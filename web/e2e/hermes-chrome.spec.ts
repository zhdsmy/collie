import { readFileSync } from "node:fs";
import { test, expect, type Locator } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "@/test/handlers";

const working = readFileSync(new URL("../src/fixtures/panes/hermes--running.txt", import.meta.url), "utf8");
const done = readFileSync(new URL("../src/fixtures/panes/hermes--done.txt", import.meta.url), "utf8");
const submitted = readFileSync(new URL("../src/fixtures/panes/hermes--submitted-input.txt", import.meta.url), "utf8");
const modern = readFileSync(new URL("../src/fixtures/panes/hermes--v0224-modern-done.txt", import.meta.url), "utf8");
const model = "example-model-with-a-very-long-name";
const history = Array.from({ length: 80 }, (_, i) => `Earlier response ${i}.`).join("\n") + "\n";
// Source-derived: top_rule_fragments fills the row with activity and _fit adds an ellipsis.
const longActivity = ["Assistant reply remains visible", `── ⠋ Running ${"x".repeat(64)}...`,
  "☤ ❯ \x1b[3m输入以改变本轮方向 · Tab 排到之后\x1b[0m", "─".repeat(80),
  " ☤ lab-model · 16K/128K · [█░░░░░░░░░] 12%"].join("\n");

async function tabIsVisible(tab: Locator): Promise<boolean> {
  return tab.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const strip = el.parentElement!.getBoundingClientRect();
    return box.width > 0 && box.left >= strip.left && box.right <= strip.right;
  });
}

test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) {
  test(`Hermes full-width activity keeps fixed status: ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    let text = longActivity;
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0
        ? { ...agent, agent: "hermes", status: text === longActivity ? "working" : "done" } : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, truncated: false, revision: text === longActivity ? 1 : 2,
    } }));
    await page.goto("/pane/w1:p1");
    const status = page.getByText("lab-model", { exact: true });
    await expect(status).toBeVisible();
    await expect(page.getByText("Assistant reply remains visible", { exact: true })).toBeVisible();
    await expect(page.locator("pre")).not.toContainText("输入以改变本轮方向");
    const statusBox = await status.boundingBox();
    const composerBox = await page.getByRole("textbox").first().boundingBox();
    expect(statusBox!.y + statusBox!.height).toBeLessThan(composerBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath("long-activity.png"), animations: "disabled" });
    text = modern;
    await expect(page.getByText("deepseek-flash", { exact: true })).toBeVisible();
    await expect(page.getByText("HERMES_UPGRADE_OK", { exact: true })).toBeVisible();
    await expect(status).toHaveCount(0);
  });

  test(`Hermes modern reply stays visible: ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/pane\//.test(request.url())) writes++;
    });
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0 ? { ...agent, agent: "hermes", status: "done" } : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: modern, truncated: false, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    const reply = page.getByText("HERMES_UPGRADE_OK", { exact: true });
    await expect(reply).toBeVisible();
    await expect(page.getByText("deepseek-flash", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss the terminal draft notice" })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("modern-mirror.png"), animations: "disabled" });
    const screen = page.getByRole("button", { name: "Show the screen rows, without cards" });
    await screen.click();
    await expect(reply).toBeVisible();
    await screen.click();
    await expect(reply).toBeVisible();
    expect(writes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["en", "zh"]) {
  test(`Hermes working footer and selected tab: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:theme:v1", preferences.theme);
      localStorage.setItem("collie:locale:v1", preferences.locale);
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    }, { theme, locale });
    await installApiStub(page);
    let text = working;
    let polls = 0;
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/(?:reply|keys|focus)(?:\?|$)/.test(request.url())) writes++;
    });
    await page.route("**/api/snapshot*", (route) => {
      polls++;
      return route.fulfill({ json: {
        ...fixtureSnapshot,
        agents: fixtureSnapshot.agents.map((agent, i) => i === 0
          ? { ...agent, agent: "hermes", status: text === working ? "working" : "done", tabId: "w1:t6", hasSession: true }
          : agent),
        tabs: Array.from({ length: 6 }, (_, i) => ({
          ...fixtureSnapshot.tabs[0]!, tabId: `w1:t${i + 1}`, number: i + 1,
          label: i === 5 ? "Hermes" : `Project ${i + 1}`, focused: i === 0,
        })),
      } });
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: history + submitted + text.replaceAll("lab-model", model),
      truncated: false, revision: 1, sessionModel: { model, reasoningEffort: "high" },
    } }));
    await page.goto("/pane/w1:p1");
    const tab = page.getByRole("navigation").getByRole("button", { name: /Hermes$/ });
    await expect(tab).toHaveAttribute("aria-current", "true");
    await expect.poll(() => tabIsVisible(tab)).toBe(true);

    const metrics = page.getByText(model, { exact: true });
    await expect(metrics).toBeVisible();
    const statusBox = await metrics.boundingBox();
    const composerBox = await page.getByRole("textbox").first().boundingBox();
    expect(statusBox!.y + statusBox!.height).toBeLessThan(composerBox!.y);
    const separators = page.getByText("─".repeat(40), { exact: true });
    await expect(separators).toHaveCount(8);
    const bordersFit = await separators.evaluateAll((glyphs) => glyphs.every((el) => {
      const row = el.parentElement!.parentElement!.getBoundingClientRect();
      const mirror = el.closest("pre")!.getBoundingClientRect();
      return row.left === mirror.left && row.right === mirror.right &&
        Math.round(row.left) === Math.round(document.documentElement.clientWidth - row.right);
    }));
    expect(bordersFit).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("working.png"), animations: "disabled" });

    // The upstream status bar stays fixed while the transcript scrolls.
    const scrolled = await page.locator("pre").first().evaluate((el) => {
      let parent = el.parentElement;
      while (parent && !["auto", "scroll"].includes(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
      if (!parent || parent.scrollHeight <= parent.clientHeight) return false;
      parent.scrollTop = 0;
      return true;
    });
    expect(scrolled).toBe(true);
    await expect.poll(async () => (await metrics.boundingBox())!.y).toBe(statusBox!.y);

    // A deliberate pan to other tabs survives an ordinary snapshot refresh.
    await tab.evaluate((el) => { el.parentElement!.scrollLeft = 0; });
    const previousPolls = polls;
    // Scrolling into history deliberately relaxes Collie's poll interval to six seconds.
    await expect.poll(() => polls, { timeout: 10000 }).toBeGreaterThan(previousPolls);
    expect(await tab.evaluate((el) => el.parentElement!.scrollLeft)).toBe(0);
    // Rotation/layout changes reveal the selected tab again, as does reopening the pane.
    await page.setViewportSize({ width: width + 30, height: 844 });
    await expect.poll(() => tabIsVisible(tab)).toBe(true);
    if (locale === "en") {
      await page.getByRole("button", { name: "Hide tabs", exact: true }).click();
      await expect(tab).toHaveCount(0);
      await page.getByRole("button", { name: /^Show tabs\./ }).click();
      await expect.poll(() => tabIsVisible(tab)).toBe(true);
    }
    await page.reload();
    await expect.poll(() => tabIsVisible(tab)).toBe(true);
    const geometry = await page.evaluate(() => ({
      x: window.scrollX, y: window.scrollY,
      viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
    }));
    expect(geometry).toEqual({ x: 0, y: 0, viewport: width + 30, document: width + 30 });

    text = done;
    await expect(metrics).toBeVisible();
    expect(writes).toBe(0);
  });
}
