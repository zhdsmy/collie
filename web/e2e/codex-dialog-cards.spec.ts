import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { zh } from "@/lib/i18n/messages/zh";
import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}`, import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`Codex native simple dialogs: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((colorMode) => {
      localStorage.setItem("collie:theme:v1", colorMode);
      localStorage.setItem("collie:locale:v1", "zh");
    }, theme);
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? { ...agent, agent: "codex", status: "blocked", hasSession: true } : agent),
    } }));
    let buffer = "";
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/pane\/.*\/(keys|reply)/.test(request.url())) writes.push(request.url());
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
      (route) => route.fulfill({ json: { paneId: "w1:p1", text: buffer, truncated: false, revision: 1 } }));
    for (const name of [
      "codex--ask-fruit.txt", "codex--v0154-notes-multiline-focused.txt",
      "codex--async-qa-options.txt", "codex--async-qa-collapsed.txt",
      "codex--v0154-plan-short.txt", "codex--v0154-plan-long.txt",
      "codex--review-scope.txt", "codex--review-base-branch.txt", "codex--trust-prompt.txt",
    ]) {
      buffer = fixture(name);
      await page.goto("/pane/w1:p1");
      let expected = splitLines(parseAnsi(buffer)).map(lineText).join("\n");
      if (name === "codex--async-qa-collapsed.txt") expected = expected.slice(0, expected.indexOf("› Ask Codex"));
      const mirror = page.locator("pre").first();
      await expect(mirror).toBeVisible();
      await expect.poll(async () => (await mirror.textContent())?.trimEnd(), { message: name }).toBe(expected.trimEnd());
      await expect(page.getByRole("group", { name: /Pick a fruit|Implement this plan|Select a review preset|Do you trust/ })).toHaveCount(0);
    }
    expect(writes).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`native-dialog-${theme}.png`), fullPage: true });
  });

  test(`Codex approval cards: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript((colorMode) => {
      localStorage.setItem("collie:theme:v1", colorMode);
      localStorage.setItem("collie:locale:v1", "zh");
    }, theme);
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "codex", status: "blocked", hasSession: true }) : agent),
    } }));
    // Derived long command retains the native approval fixture's layout and ANSI.
    const buffer = fixture("codex--approval-exec.txt").replaceAll(
      "/tmp/collie-codex-probe.txt",
      "/tmp/" + "long-command-value-".repeat(12) + ".txt",
    );
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
      (route) => route.fulfill({ json: { paneId: "w1:p1", text: buffer, truncated: false, revision: 1 } }));
    await page.goto("/pane/w1:p1");
    const approval = page.getByRole("group", { name: "Would you like to run the following command?", exact: true });
    await expect(approval.getByText(zh["prompt.approval.environment"], { exact: true })).toBeVisible();
    await approval.getByRole("button", { name: zh["prompt.approval.showCommand"], exact: true }).click();
    await expect(approval.getByRole("button", { name: zh["prompt.approval.hideCommand"], exact: true })).toHaveAttribute("aria-expanded", "true");
    const command = approval.getByRole("region", { name: zh["prompt.approval.command"], exact: true });
    await expect(command).toContainText("long-command-value-".repeat(12));
    await expect.poll(() => command.evaluate((element) => {
      const clip = element.closest('[data-slot="collapse"]')?.getBoundingClientRect();
      return clip !== undefined && clip.height >= element.getBoundingClientRect().height;
    })).toBe(true);
    await expect(approval.getByRole("button", { name: /Yes, proceed/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`approval-${theme}.png`), fullPage: true, animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  });
}
