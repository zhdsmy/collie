import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "@/test/handlers";

const working = readFileSync(new URL("../src/fixtures/panes/codex--working.txt", import.meta.url), "utf8");
const done = readFileSync(new URL("../src/fixtures/panes/codex--fresh-idle.txt", import.meta.url), "utf8");
const queue = readFileSync(new URL("../src/fixtures/panes/codex--queue-context-inline.txt", import.meta.url), "utf8")
  .replace("Earlier work completed.", "• Working (3s • esc to interrupt)")
  // Derived long key label exercises horizontal overflow without sending a key to an agent.
  .replace("Tab", "Ctrl+Shift+Q");
const history = Array.from({ length: 80 }, (_, i) => `Earlier response ${i}.`).join("\n") + "\n";

test.use({ serviceWorkers: "block" });
for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["en", "zh"]) {
  test(`Codex fixed operation hints: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:theme:v1", preferences.theme);
      localStorage.setItem("collie:locale:v1", preferences.locale);
    }, { theme, locale });
    await installApiStub(page);
    let text = working;
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/(?:reply|keys|focus)(?:\?|$)/.test(request.url())) writes++;
    });
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0
        ? Object.assign({}, agent, { agent: "codex", status: text === done ? "idle" : "working", hasSession: true })
        : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: history + text, truncated: false, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    const operations = page.getByText("esc to interrupt", { exact: true });
    const contextName = locale === "zh" ? "上下文剩余 93%" : "Context 93% left";
    const metrics = page.getByRole("img", { name: contextName, exact: true });
    await expect(operations).toHaveCount(1);
    await expect(operations).toBeVisible();
    await expect(page.getByText(/\(3s/)).toBeVisible();
    const statusBox = await metrics.boundingBox();
    const hintBox = await operations.boundingBox();
    const composerBox = await page.getByRole("textbox").first().boundingBox();
    expect(hintBox!.y).toBeGreaterThanOrEqual(statusBox!.y + statusBox!.height);
    expect(hintBox!.y + hintBox!.height).toBeLessThan(composerBox!.y);
    const hintFits = await operations.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const glyphs = range.getBoundingClientRect();
      const clip = el.parentElement!.parentElement!.parentElement!.getBoundingClientRect();
      return glyphs.top >= clip.top && glyphs.bottom <= clip.bottom;
    });
    expect(hintFits).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("working.png") });

    const scrolled = await page.getByText("Earlier response 79.", { exact: true }).evaluate((el) => {
      let parent = el.parentElement;
      while (parent && !["auto", "scroll"].includes(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
      if (!parent || parent.scrollHeight <= parent.clientHeight) return false;
      parent.scrollTop = 0;
      return true;
    });
    expect(scrolled).toBe(true);
    await expect.poll(async () => (await operations.boundingBox())!.y).toBe(hintBox!.y);
    await expect.poll(async () => (await metrics.boundingBox())!.y).toBe(statusBox!.y);

    // Both actual hints share one optional row; its end stays reachable on narrow screens.
    text = queue;
    const queued = page.getByText("to queue message", { exact: true });
    await expect(queued).toHaveCount(1, { timeout: 10000 });
    await expect(operations).toBeVisible();
    const scroll = await queued.evaluate((el) => {
      let parent = el.parentElement;
      while (parent && getComputedStyle(parent).overflowX !== "auto") parent = parent.parentElement;
      if (!parent) return null;
      parent.scrollLeft = parent.scrollWidth;
      return {
        x: parent.scrollLeft,
        // scrollWidth rounds to CSS pixels; glyph bounds retain fractional font advances.
        fits: el.getBoundingClientRect().right <= parent.getBoundingClientRect().right + 1,
      };
    });
    expect(scroll?.fits).toBe(true);
    if (width === 320) expect(scroll!.x).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("queue.png") });
    const geometry = await page.evaluate(() => ({
      x: window.scrollX, y: window.scrollY,
      viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
    }));
    expect(geometry).toEqual({ x: 0, y: 0, viewport: width, document: width });

    text = done;
    await expect(operations).toHaveCount(0, { timeout: 10000 });
    await expect(queued).toHaveCount(0);
    await expect(page.getByRole("img", { name: locale === "zh" ? /^上下文剩余 \d+%$/ : /^Context \d+% left$/ })).toBeVisible();
    expect(writes).toBe(0);

    // Raw mode retains the original TUI indicator. Turning wrapping off keeps the display lift.
    text = working;
    await page.evaluate(() => localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ rawTerminal: true })));
    await page.reload();
    await expect(page.getByText("esc to interrupt", { exact: false })).toHaveCount(1);
    await expect(metrics).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ wrap: false })));
    await page.reload();
    await expect(operations).toBeVisible();
    await expect(metrics).toBeVisible();
    expect(writes).toBe(0);
  });
}
