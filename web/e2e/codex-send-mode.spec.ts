import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot, sendAnswer } from "../src/test/handlers";

const queued = readFileSync(new URL("../src/fixtures/panes/codex--v0163-queued-steer.txt", import.meta.url), "utf8");
const claude = readFileSync(new URL("../src/fixtures/panes/claude--v2301-working-queued-message--w100.txt", import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

test("Codex queue setting and immediate steering fit a 320px phone", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installApiStub(page);
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "zh");
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ mode: "mirror", showHistory: false }));
  });
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0 ? Object.assign({}, agent, { agent: "codex", canSteer: true, status: "working", surface: { revision: 1, turn: "running", modal: "none", composer: "empty" } }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: { paneId: "w1:p1", text: queued, truncated: false, revision: 1 } }));
  const modes: string[] = [];
  await page.route("**/api/send", (route) => {
    const body = route.request().postDataJSON();
    modes.push(body.when === "steer" ? `${body.mode}:steer` : body.mode);
    return route.fulfill({ json: sendAnswer(body.id, "sent") });
  });
  await page.goto("/settings/device");
  await expect(page.getByText("发送方式", { exact: true })).toBeVisible();
  await page.getByRole("radiogroup", { name: "发送方式" }).getByRole("radio", { name: "立即引导" }).click();
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "发送方式" }).getByRole("radio", { name: "立即引导" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "发送方式" }).getByRole("radio", { name: "排队" }).click();
  await page.screenshot({ path: info.outputPath("codex-send-setting.png") });
  await page.goto("/pane/w1:p1");
  await expect(page.getByText(/队列最后一条:/)).toBeVisible();
  const box = page.getByRole("textbox").first();
  await box.fill("保留这条草稿");
  await page.getByRole("button", { name: "立即引导", exact: true }).first().click();
  await expect.poll(() => modes).toEqual(["steer-queued:steer"]);
  await expect(box).toHaveValue("保留这条草稿");
  const steer = page.getByRole("button", { name: "立即引导", exact: true }).last();
  const rect = await steer.boundingBox();
  expect(rect!.height).toBeGreaterThanOrEqual(36);
  expect(await steer.evaluate((el) => getComputedStyle(el, "::before").top)).toBe("-4px");
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("codex-queue-steer.png") });
  await steer.click();
  await expect.poll(() => modes).toEqual(["steer-queued:steer", "send:steer"]);
});

test("Claude uses the shared sending choice on a 320px phone", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installApiStub(page);
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "zh");
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ mode: "mirror", showHistory: false }));
  });
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, i) => i === 0 ? Object.assign({}, agent, { agent: "claude", canSteer: true, status: "working", surface: { revision: 1, turn: "running", modal: "none", composer: "empty" } }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: { paneId: "w1:p1", text: claude, revision: 1 } }));
  const modes: string[] = [];
  await page.route("**/api/send", (route) => {
    const body = route.request().postDataJSON();
    modes.push(body.when === "steer" ? `${body.mode}:steer` : body.mode);
    return route.fulfill({ json: sendAnswer(body.id, body.when === "steer" ? "steered" : "sent") });
  });
  await page.goto("/settings/device");
  const choice = page.getByRole("radiogroup", { name: "发送方式" });
  await choice.getByRole("radio", { name: "立即引导" }).click();
  await page.reload();
  await expect(choice.getByRole("radio", { name: "立即引导" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radiogroup", { name: "发送方式" })).toHaveCount(1);
  await expect(page.getByText(/暂仅适配 Codex、Claude Code 和 Antigravity/)).toBeVisible();
  await choice.getByRole("radio", { name: "排队" }).click();
  await page.screenshot({ path: info.outputPath("claude-send-settings.png") });
  await page.goto("/pane/w1:p1");
  const box = page.getByRole("textbox").first();
  const primary = page.locator('[data-slot="composer-primary"]');
  await box.fill("这条消息排队");
  await primary.click();
  await expect.poll(() => modes).toEqual(["send"]);
  await expect(box).toHaveValue("");
  await box.fill("这条消息立即引导");
  const steer = page.getByRole("button", { name: "立即引导", exact: true });
  const rect = await steer.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("claude-queue-steer.png") });
  await steer.click();
  await expect.poll(() => modes).toEqual(["send", "send:steer"]);
  await expect(box).toHaveValue("");
  await page.goto("/settings/device");
  await choice.getByRole("radio", { name: "立即引导" }).click();
  await page.goto("/pane/w1:p1");
  await box.fill("按默认方式立即引导");
  await primary.click();
  await expect.poll(() => modes).toEqual(["send", "send:steer", "send:steer"]);
  await expect(box).toHaveValue("");
  await box.fill("/status");
  await primary.click();
  await expect.poll(() => modes).toEqual(["send", "send:steer", "send:steer", "command"]);
});
