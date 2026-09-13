import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}`, import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`Codex approval, notes and review cards: ${theme}`, async ({ page }, testInfo) => {
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
    let buffer = fixture("codex--approval-exec.txt").replaceAll(
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
    await expect(approval.getByRole("button", { name: /Yes, proceed/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`approval-${theme}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    buffer = fixture("codex--v0154-notes-multiline-focused.txt");
    await page.reload();
    const notes = page.getByRole("textbox", { name: zh["dialog.picker.notes"], exact: true });
    await expect(notes).toHaveValue("Card note 中文 first line\n\nSecond line with 1, 2, 3.");
    await expect(notes).not.toBeFocused();
    await notes.fill("本地补充\n\n1. 自定义回答");
    await expect(notes).toHaveValue("本地补充\n\n1. 自定义回答");
    await page.screenshot({ path: testInfo.outputPath(`notes-${theme}.png`), fullPage: true });

    buffer = fixture("codex--review-scope.txt");
    await page.reload();
    const review = page.getByRole("group", { name: "Select a review preset", exact: true });
    const keys: string[][] = [];
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: payload is produced by the client under test; only this captured transition is allowed.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt: string };
      keys.push(body.keys);
      expect(body.keys).toEqual(["Enter"]);
      expect(body.expected_prompt).toContain("Select a review preset");
      buffer = fixture("codex--review-base-branch.txt");
      return route.fulfill({ json: { ok: true } });
    });
    await expect(review.getByRole("button", { name: /Review uncommitted changes/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`review-${theme}.png`), fullPage: true });
    await review.getByRole("button", { name: /Review against a base branch/ }).click();
    await expect(page.getByRole("group", { name: "Select a base branch", exact: true })).toBeVisible();
    expect(keys).toEqual([["Enter"]]);
  });
}
