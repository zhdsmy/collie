import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

test("background jobs sheet fits a 320px phone and leaves the composer in place", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
  await installApiStub(page);
  const command = "bun run check --filter=" + "long-package-name-".repeat(12);
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0 ? Object.assign({}, agent, {
      jobs: [
        { id: "build", label: "Build", command, startedAt },
        { id: "check", label: "Check", command: "bun test", startedAt, endedAt: startedAt, exitCode: 1 },
      ],
    }) : agent),
  } }));
  await page.goto("/pane/w1:p1");
  const mark = page.locator('[data-slot="belt-jobs"]');
  await expect(mark).toBeInViewport();
  await expect(mark.locator('[data-slot="belt-jobs-count"]')).toHaveText("1");
  const before = await mark.boundingBox();
  await mark.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-slot="jobs-running"]')).toContainText(command);
  await expect(sheet.locator('[data-slot="belt-job-exit"]')).toHaveText("Exit code 1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const longCommand = sheet.locator('[data-slot="belt-job-command"]').first();
  expect(await longCommand.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("jobs-320.png") });
  await sheet.getByRole("button", { name: "Close", exact: true }).click();
  await expect(sheet).toHaveCount(0);
  expect(await mark.boundingBox()).toEqual(before);
});
