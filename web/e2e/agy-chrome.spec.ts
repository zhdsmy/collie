import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const idle = readFileSync(new URL("../src/fixtures/panes/agy--v144-idle--w50.txt", import.meta.url), "utf8");
const working = readFileSync(new URL("../src/fixtures/panes/agy--v144-working--w119.txt", import.meta.url), "utf8");
const auto = readFileSync(new URL("../src/fixtures/panes/agy--v144-auto-placeholder--w119.txt", import.meta.url), "utf8");
const quota = readFileSync(new URL("../src/fixtures/panes/agy--v144-quota--w119.txt", import.meta.url), "utf8");

test.use({ serviceWorkers: "block" });
test("AGY narrow Resume opens a recognized menu", async ({ page }, testInfo) => {
  const text = readFileSync(new URL("../src/fixtures/panes/agy--v145-resume--w50.txt", import.meta.url), "utf8");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "en");
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
  });
  await installApiStub(page);
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? { ...agent, agent: "agy", status: "idle", hasSession: false } : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1", text, revision: 1,
  } }));
  await page.goto("/pane/w1:p1");
  for (const name of ["Select", "Go back", "Move up", "Move down"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeInViewport();
  }
  await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("agy-resume-menu.png") });
});

for (const cols of [119, 50]) {
  test(`AGY model menu replaces the unread warning: ${cols} columns`, async ({ page }, testInfo) => {
    const text = readFileSync(new URL(`../src/fixtures/panes/agy--v144-model--w${cols}.txt`, import.meta.url), "utf8");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? { ...agent, agent: "agy", status: "idle", hasSession: false } : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
    const select = page.getByRole("button", { name: "Select", exact: true });
    await expect(select).toBeVisible();
    for (const name of ["Move up", "Move down", "Left, Effort (medium)", "Right, Effort (medium)"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeInViewport();
    }
    await expect(page.getByText("GPT-OSS 120B (Medium)", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Go back", exact: true })).toHaveCount(cols === 119 ? 1 : 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.screenshot({ path: testInfo.outputPath("agy-model-menu.png") });
  });
}

for (const width of [320, 390]) {
  test(`AGY Chat keeps its dedicated composer statusline: ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "zh");
      localStorage.setItem("collie:theme:v1", "dark");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "chat" }));
    });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "agy", status: "idle", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: quota, revision: 1,
    } }));
    await page.route("**/api/pane/*/chat*", (route) => route.fulfill({ json: {
      paneId: "w1:p1", available: true, page: "live", gen: 1, rev: 1,
      head: 1_000_001, oldest: 1_000_000, hasOlder: false,
      upserts: [
        { uuid: "agy-0", seq: 1_000_000, ts: "", role: "user", parts: [{ kind: "text", text: "检查 AGY 聊天视图" }] },
        { uuid: "agy-1", seq: 1_000_001, ts: "", role: "assistant", parts: [{ kind: "text", text: "原生会话已显示在 **Chat** 中。" }] },
      ],
    } }));
    await page.goto("/pane/w1:p1");
    const stream = page.locator('[data-slot="session-stream"]');
    await expect(stream).toBeVisible();
    await expect(stream.getByText("原生会话已显示在", { exact: false })).toBeVisible();
    const strip = page.locator('[data-slot="agy-statusline"]');
    await expect(strip).toHaveCount(1);
    await expect(strip.getByText("Gemini 4 Argon (Medium)", { exact: true })).toBeVisible();
    await expect(strip.getByText("5h 98.6% ↻4h59m", { exact: true })).toBeVisible();
    await expect(strip.getByText("7d 97.2% ↻6d6h", { exact: true })).toBeVisible();
    const input = page.getByRole("textbox").first();
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("");
    const stripBox = await strip.boundingBox();
    const inputBox = await input.boundingBox();
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(inputBox!.y);
    await expect(page.getByText("Collie 未识别此界面", { exact: false })).toHaveCount(0);
    const bar = page.locator('[data-slot="harness-bar"]');
    for (const label of ["模型", "压缩", "恢复"]) {
      const button = bar.getByRole("button", { name: label, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      const buttonBox = await button.boundingBox();
      expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(inputBox!.y);
    }
    await bar.evaluate((el) => { el.parentElement!.scrollLeft = el.parentElement!.scrollWidth; });
    await bar.getByRole("button", { name: "恢复", exact: true }).click({ trial: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({ path: testInfo.outputPath("agy-chat-statusline.png") });
  });

  test(`AGY status fields and working composer: ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "zh");
      localStorage.setItem("collie:theme:v1", "dark");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    let text = idle;
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "agy", status: text === working ? "working" : "idle", hasSession: false }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1,
    } }));

    for (const state of ["idle", "working", "auto"] as const) {
      text = state === "working" ? working : state === "auto" ? auto : idle;
      await page.goto("/pane/w1:p1");
      const strip = page.locator('[data-slot="agy-statusline"]');
      await expect(strip).toHaveCount(1);
      const hint = strip.getByText(state === "auto" ? "auto" : state === "idle" ? "? for shortcuts" : "esc to cancel", { exact: true });
      const model = strip.getByText(state === "auto" ? "Gemini 4 Argon (Medium)" : "Gemini 4 Argon · medium", { exact: true });
      await expect(hint).toBeVisible();
      await expect(model).toBeVisible();
      const hintBox = await hint.boundingBox();
      const modelBox = await model.boundingBox();
      expect(modelBox!.x).toBeGreaterThan(hintBox!.x + hintBox!.width);
      await expect(page.getByText("Collie 未识别此界面", { exact: false })).toHaveCount(0);
      const input = page.getByRole("textbox").first();
      await expect(input).toBeEnabled();
      if (state === "auto") {
        await expect(input).toHaveValue("");
        await expect(strip.getByText("ctx 100%", { exact: true })).toBeVisible();
        await expect(strip.getByText("Σin 0", { exact: true })).toHaveCount(1);
        await expect(strip.getByText("Σout 0", { exact: true })).toHaveCount(1);
      }
      const stripBox = await strip.boundingBox();
      const inputBox = await input.boundingBox();
      expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(inputBox!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: testInfo.outputPath(`agy-${state}.png`) });
    }
  });
}
