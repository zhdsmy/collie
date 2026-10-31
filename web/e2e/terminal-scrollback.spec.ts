import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "../src/test/handlers";

test.use({ serviceWorkers: "block" });

for (const harness of ["hermes", "codex", "claude", "antigravity"]) {
  test(`${harness} loads older terminal rows without opening conversation history`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" })));
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: [
        { ...fixtureSnapshot.agents[0]!, agent: harness, status: "idle", hasSession: true },
        ...fixtureSnapshot.agents.slice(1),
      ],
    } }));
    let olderReads = 0;
    const screen = "Recent terminal output";
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => {
      const older = new URL(route.request().url()).searchParams.get("purpose") === "older";
      if (older) olderReads++;
      return route.fulfill({ json: {
        paneId: "w1:p1", revision: 1, truncated: !older,
        text: older ? `Older terminal output\n${screen}` : screen,
      } });
    });
    await page.goto("/pane/w1:p1");
    const loadOlder = page.getByRole("button", { name: "Load older", exact: true });
    await expect(loadOlder).toBeVisible();
    await expect(page.getByRole("button", { name: "Show entire history", exact: true })).toHaveCount(0);
    expect(olderReads).toBe(0);
    await loadOlder.click();
    await expect(page.getByText("Older terminal output", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/pane\/w1:p1$/);
    await expect(loadOlder).toHaveCount(0);
    expect(olderReads).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`${harness}-terminal-history.png`), animations: "disabled" });
    await page.getByRole("button", { name: "Pane actions", exact: true }).click();
    await expect(page.getByRole("button", { name: "Conversation history", exact: true })).toBeVisible();
  });
}
