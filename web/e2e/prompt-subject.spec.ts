import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const text = readFileSync(new URL("../src/fixtures/panes/claude--v2291-permission-bash-subagent.txt", import.meta.url), "utf8");

test.use({ serviceWorkers: "block" });

for (const paneView of ["chat", "terminal"]) {
  test(`permission subject scrolls at 320px in ${paneView}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript((view) => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: view }));
    }, paneView);
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "claude", status: "blocked", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) =>
      route.fulfill({ json: { paneId: "w1:p1", text, truncated: false, revision: 1 } }));
    await page.goto("/pane/w1:p1");

    const card = page.getByRole("group", { name: "Do you want to proceed?", exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByText("Do you want to proceed?", { exact: true })).toHaveCount(1);
    await expect(card.getByText("Bash command", { exact: true })).toBeVisible();
    const body = card.locator("pre");
    await expect(body).toContainText("Restore committed pane route in copy and build");
    expect(await body.evaluate((el) => ({
      wraps: el.scrollWidth <= el.clientWidth + 1,
      scrolls: el.scrollHeight > el.clientHeight,
      bounded: el.clientHeight <= window.innerHeight * 0.22 + 1,
    }))).toEqual({ wraps: true, scrolls: true, bounded: true });
    await expect(card.getByRole("button", { name: "Yes", exact: true })).toBeInViewport();
    await expect(card.getByRole("button", { name: "No", exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("permission-subject.png") });
    await body.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    expect(await body.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)).toBe(true);
  });
}
