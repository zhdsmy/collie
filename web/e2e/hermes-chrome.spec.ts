import { readFileSync } from "node:fs";
import { test, expect, type Locator } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "@/test/handlers";

const working = readFileSync(new URL("../src/fixtures/panes/hermes--working.txt", import.meta.url), "utf8");
const done = readFileSync(new URL("../src/fixtures/panes/hermes--done.txt", import.meta.url), "utf8");
const hint = "msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel";
const model = "example-model-with-a-very-long-name";
const history = Array.from({ length: 80 }, (_, i) => `Earlier response ${i}.`).join("\n") + "\n";

async function tabIsVisible(tab: Locator): Promise<boolean> {
  return tab.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const strip = el.parentElement!.getBoundingClientRect();
    return box.width > 0 && box.left >= strip.left && box.right <= strip.right;
  });
}

test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["en", "zh"]) {
  test(`Hermes working footer and selected tab: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:theme:v1", preferences.theme);
      localStorage.setItem("collie:locale:v1", preferences.locale);
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
      paneId: "w1:p1", text: history + text.replace("example-model", model.slice(0, 23) + "..."),
      truncated: false, revision: 1, sessionModel: { model, reasoningEffort: "high" },
    } }));
    await page.goto("/pane/w1:p1");
    const tab = page.getByRole("navigation").getByRole("button", { name: /Hermes$/ });
    await expect(tab).toHaveAttribute("aria-current", "true");
    await expect.poll(() => tabIsVisible(tab)).toBe(true);

    const metrics = page.getByText(`${model} high`, { exact: true });
    const operations = page.getByText(hint, { exact: true });
    await expect(metrics).toBeVisible();
    await expect(operations).toHaveCount(1);
    await expect(operations).toBeVisible();
    const statusBox = await metrics.boundingBox();
    const hintBox = await operations.boundingBox();
    const composerBox = await page.getByRole("textbox").first().boundingBox();
    expect(hintBox!.y).toBeGreaterThanOrEqual(statusBox!.y + statusBox!.height);
    expect(hintBox!.y + hintBox!.height).toBeLessThan(composerBox!.y);
    await page.screenshot({ path: testInfo.outputPath("working.png") });

    // Scroll the transcript itself. The two lifted rows must retain their position and the last
    // hint remains accessible through its own horizontal pan without widening the document.
    const scrolled = await page.getByText("A response is still streaming.", { exact: true }).evaluate((el) => {
      let parent = el.parentElement;
      while (parent && !["auto", "scroll"].includes(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
      if (!parent || parent.scrollHeight <= parent.clientHeight) return false;
      parent.scrollTop = 0;
      return true;
    });
    expect(scrolled).toBe(true);
    await expect.poll(async () => (await operations.boundingBox())!.y).toBe(hintBox!.y);
    await expect.poll(async () => (await metrics.boundingBox())!.y).toBe(statusBox!.y);
    await operations.evaluate((el) => { el.parentElement!.parentElement!.scrollLeft = 10000; });
    const hintEndVisible = await operations.evaluate((el) =>
      el.getBoundingClientRect().right <= el.parentElement!.parentElement!.getBoundingClientRect().right);
    expect(hintEndVisible).toBe(true);
    if (width === 320) expect(await operations.evaluate((el) => el.parentElement!.parentElement!.scrollLeft)).toBeGreaterThan(0);

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
    await expect(operations).toHaveCount(0);
    await expect(metrics).toBeVisible();
    expect(writes).toBe(0);
  });
}
