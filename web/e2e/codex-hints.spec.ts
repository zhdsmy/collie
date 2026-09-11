import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "@/test/handlers";

const working = readFileSync(new URL("../src/fixtures/panes/codex--working.txt", import.meta.url), "utf8");
const done = readFileSync(new URL("../src/fixtures/panes/codex--fresh-idle.txt", import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) for (const theme of ["light", "dark"]) for (const locale of ["en", "zh"]) {
  test(`Codex has no separate operation strip: ${width} ${theme} ${locale}`, async ({ page }) => {
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
      paneId: "w1:p1", text, truncated: false, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    const metrics = page.getByRole("img", { name: locale === "zh" ? /^上下文剩余 \d+%$/ : /^Context \d+% left$/ });
    await expect(metrics).toBeVisible();
    const indicator = page.getByText("esc to interrupt", { exact: false });
    await expect(indicator).toBeVisible();
    expect(await indicator.evaluate((el) => el.closest("pre") !== null)).toBe(true);
    await expect(page.getByText("esc to interrupt", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox").first()).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

    text = done;
    await page.reload();
    await expect(indicator).toHaveCount(0);
    await expect(metrics).toBeVisible();
    await expect(page.getByText("esc to interrupt", { exact: true })).toHaveCount(0);
    expect(writes).toBe(0);
  });
}
