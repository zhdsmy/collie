import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const permission = readFileSync(new URL("../src/fixtures/panes/agy--v144-permission-status--w80.txt", import.meta.url), "utf8");
const idle = readFileSync(new URL("../src/fixtures/panes/agy--v144-idle--w50.txt", import.meta.url), "utf8");

test.use({ serviceWorkers: "block" });
for (const width of [320, 390]) {
  test(`AGY permission retains wrapped choices and the statusline: ${width}`, async ({ page }, testInfo) => {
    let text = permission;
    const keys: string[][] = [];
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "agy", status: "blocked", hasSession: false }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: keys.length + 1,
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: this request is produced by Collie's typed key client, not external input.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
      expect(body.expected_prompt).toContain("Run this command?");
      keys.push(body.keys);
      text = idle;
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    const card = page.getByRole("group", { name: "Run this command?", exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Yes, run command", exact: true })).toBeVisible();
    await expect(card.getByText("'printf'", { exact: true })).toBeVisible();
    await expect(card.getByText("settings.json)", { exact: true })).toBeVisible();
    await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
    await expect(page.locator('[data-slot="agy-statusline"]')).toHaveCount(1);
    await expect(page.getByRole("img", { name: "accept-edits", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath("agy-permission.png") });
    await card.getByRole("button", { name: "No, cancel", exact: true }).click();
    await expect.poll(() => keys).toEqual([["4"]]);
    await expect(card).toHaveCount(0);
  });
}
