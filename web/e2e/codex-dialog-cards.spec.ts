import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { zh } from "@/lib/i18n/messages/zh";
import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { fixtureSnapshot, sendAnswer } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}`, import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  test(`Codex Computer Use permission card: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
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
    let state = "open";
    const writes: string[][] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/reply")) writes.push(["reply"]);
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
      (route) => route.fulfill({ json: { paneId: "w1:p1", text: state === "closed" ? "Permission test completed."
        : fixture(`codex--v0162-tool-approval-${state}.txt`), truncated: false, revision: 1 } }));
    await page.route("**/api/send", (route) => {
      const id = String(route.request().postDataJSON()?.id ?? "send-1");
      return route.fulfill({ json: sendAnswer(id, "refused", "not_free", {
        surface: { revision: 1, turn: "unknown", modal: { ask: { id: "ask-perm", kind: "permission", options: [], channel: "keys", hash: "0" } }, composer: "unknown" },
      }) });
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: own client's payload; transitions were captured against an inert local MCP server.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt: string };
      expect(body.expected_prompt).toContain('Allow Computer Use to use "TextEdit"?');
      expect(body.keys).toEqual([state === "open" ? "Down" : "Enter"]);
      writes.push(body.keys);
      state = state === "open" ? "session" : "closed";
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    const panel = page.getByRole("group", { name: 'Allow Computer Use to use "TextEdit"?', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("App: TextEdit", { exact: true })).toBeVisible();
    for (const label of ["Allow", "Allow for this session", "Always allow", "Cancel"]) {
      await expect(panel.getByRole("button", { name: new RegExp(`^${label} ${label === "Cancel" ? "Cancel" : "Run"} `) })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(writes).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`computer-use-${theme}.png`), fullPage: true });
    await page.getByRole("textbox").fill("Keep this draft until after the permission dialog.");
    await page.getByRole("button", { name: zh["composer.send.sendAria"], exact: true }).click();
    await expect(page.getByText(zh["composer.protocol.notFree"], { exact: false })).toBeVisible();
    expect(writes).toEqual([]);
    await expect(page.getByRole("textbox")).toHaveValue("Keep this draft until after the permission dialog.");
    await panel.getByRole("button", { name: /^Allow for this session / }).click();
    await expect(panel).toHaveCount(0);
    expect(writes).toEqual([["Down"], ["Enter"]]);
  });

  test(`Codex native simple dialogs: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((colorMode) => {
      localStorage.setItem("collie:theme:v1", colorMode);
      localStorage.setItem("collie:locale:v1", "zh");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
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
    // Asynchronous questions and the 0.149 trust prompt stay native; questions, plans and review
    // pickers have cards (codex/ASK_NOTES.md, PLAN_NOTES.md, REVIEW_NOTES.md).
    for (const name of ["codex--async-qa-options.txt", "codex--async-qa-collapsed.txt", "codex--trust-prompt.txt"]) {
      buffer = fixture(name);
      await page.goto("/pane/w1:p1");
      let expected = splitLines(parseAnsi(buffer)).map(lineText).join("\n");
      if (name === "codex--async-qa-collapsed.txt") expected = expected.slice(0, expected.indexOf("› Ask Codex"));
      const mirror = page.locator("pre").first();
      await expect(mirror).toBeVisible();
      await expect.poll(async () => (await mirror.textContent())?.trimEnd(), { message: name }).toBe(expected.trimEnd());
      await expect(page.getByRole("group", { name: /Choose the Collie QA layout|Do you trust/ })).toHaveCount(0);
    }
    expect(writes).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`native-dialog-${theme}.png`), fullPage: true });
  });

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
    const command = approval.getByRole("region", { name: zh["prompt.approval.command"], exact: true });
    await expect(command).toContainText("long-command-value-".repeat(12));
    await expect.poll(() => command.evaluate((element) => {
      const clip = element.closest('[data-slot="collapse"]')?.getBoundingClientRect();
      return clip !== undefined && clip.height >= element.getBoundingClientRect().height;
    })).toBe(true);
    await expect(approval.getByRole("button", { name: /Yes, proceed/ })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`approval-${theme}.png`), fullPage: true, animations: "disabled" });
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
