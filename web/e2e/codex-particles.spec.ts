import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "@/test/handlers";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/codex--v0154-particles-${name}.txt`, import.meta.url), "utf8");
const empty = fixture("working");
const draft = fixture("draft");
const braille = /[⠁⠂⠄⠈⠐⠠⡀⢀]/u;

for (const theme of ["light", "dark"]) {
  test(`Codex waits through partial paste frames: ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((selected) => {
      localStorage.setItem("collie:theme:v1", selected);
      localStorage.setItem("collie:locale:v1", "en");
    }, theme);
    await installApiStub(page);
    const message = "请检查这个输入问题，再完整核对 fork 中的所有内容";
    const prefix = "请检查这个输入问题";
    let readyAt = 0;
    let submitted = false;
    const calls: { text: string; submit: boolean; expected_prompt?: string }[] = [];
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0
        ? Object.assign({}, agent, { agent: "codex", status: "working", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => {
      const paint = "\u001b[0m\u001b[48;2;57;57;71m";
      const particle = "\u001b[0m\u001b[38;2;110;114;134m\u001b[48;2;57;57;71m⠄" + paint;
      const visibleDraft = Date.now() < readyAt ? prefix : message;
      const text = !readyAt || submitted ? empty : empty.replace(
        "\u001b[2m\u001b[48;2;57;57;71mAsk Codex to do anything", paint + visibleDraft.replaceAll(" ", particle),
      );
      return route.fulfill({ json: { paneId: "w1:p1", text, revision: 1, truncated: false } });
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/reply", (route) => {
      // SAFETY: this request is produced by the app under test, whose reply body has this shape.
      const body = route.request().postDataJSON() as typeof calls[number];
      calls.push(body);
      if (!body.submit) readyAt = Date.now() + 600;
      else {
        if (body.expected_prompt !== `› ${message}`) return route.fulfill({
          status: 409, json: { ok: false, code: "prompt_changed", error: "prompt changed" },
        });
        submitted = true;
      }
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    await page.getByRole("textbox").first().fill(message);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("textbox").first()).toHaveValue("");
    expect(submitted).toBe(true);
    expect(calls).toEqual([
      { text: message, submit: false },
      { text: "", submit: true, expected_prompt: `› ${message}` },
    ]);
  });
}

for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
  test(`Codex 0.154 particles: ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((selected) => {
      localStorage.setItem("collie:theme:v1", selected);
      localStorage.setItem("collie:locale:v1", "en");
    }, theme);
    await installApiStub(page);
    let text = empty;
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0
        ? Object.assign({}, agent, { agent: "codex", status: "working", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1, truncated: false,
    } }));
    await page.goto("/pane/w1:p1");
    await expect(page.getByRole("img", { name: /^Context 23% left$/ })).toBeVisible();
    const working = page.getByText("esc to interrupt", { exact: false });
    await expect(working).toBeVisible();
    const mirror = await working.evaluate((el) => {
      const pre = el.closest("pre")!;
      return { text: pre.textContent, backgrounds: [...pre.querySelectorAll("span")].filter((span) => span.style.backgroundColor).length };
    });
    expect(mirror.text).not.toMatch(braille);
    expect(mirror.backgrounds).toBe(0);
    await expect(page.getByText("Ask Codex to do anything", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Take over/i })).toHaveCount(0);
    await expect(page.getByRole("textbox").first()).toBeEnabled();

    text = draft;
    await page.reload();
    const takeover = page.getByRole("button", { name: /Take over/i });
    await expect(takeover).toBeVisible();
    await expect(page.getByText("Probe 你好 . · ⠁⠂ [Image #1] /private/tmp/sample.png", { exact: true })).toBeVisible();
    await takeover.click();
    await expect(page.getByRole("textbox").first()).toHaveValue("Probe 你好 . · ⠁⠂ [Image #1] /private/tmp/sample.png");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

    text = empty;
    await page.evaluate(() => localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ rawTerminal: true })));
    await page.reload();
    await expect(page.getByText("Ask Codex to do anything", { exact: false })).toBeVisible();
    await expect(page.getByText(braille).first()).toBeVisible();
  });
}
