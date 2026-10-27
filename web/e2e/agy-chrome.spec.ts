import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const idle = readFileSync(new URL("../src/fixtures/panes/agy--v144-idle--w50.txt", import.meta.url), "utf8");
const working = readFileSync(new URL("../src/fixtures/panes/agy--v144-working--w119.txt", import.meta.url), "utf8");
const auto = readFileSync(new URL("../src/fixtures/panes/agy--v144-auto-placeholder--w119.txt", import.meta.url), "utf8");
const capturedQuota = readFileSync(new URL("../src/fixtures/panes/agy--v144-quota--w119.txt", import.meta.url), "utf8");

const quota = capturedQuota.replace(/auto[^\r\n]*/, "Gemini 4 Argon (High)  auto  idle  ctx 87%  main  Gemini 5h 82.7% ↻3h32m · 7d 92.4% ↻5d19h  Claude/GPT 5h 100% ↻4h58m · 7d 86% ↻6d17h  v1.4.4");

test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) {
  test(`AGY background tasks keep the composer recognized: ${width}`, async ({ page }, testInfo) => {
    const text = readFileSync(new URL("../src/fixtures/panes/agy--v145-background-task--w80.txt", import.meta.url), "utf8");
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:theme:v1", "dark");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0 ? { ...agent, agent: "agy", status: "idle", hasSession: true } : agent),
    } }));
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/pane\//.test(request.url())) writes++;
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
    await expect(page.getByText("[00:10:50]", { exact: false })).toBeVisible();
    await expect(page.getByText("Gemini 4 Argon", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(writes).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("agy-background-tasks.png") });
  });
}
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
    await expect(strip.getByTitle("Gemini 4 Argon high", { exact: true })).toBeVisible();
    await expect(strip.getByRole("img", { name: "Gemini 5h 82.7% 余 ↻3h32m", exact: true })).toBeVisible();
    await expect(strip.getByRole("img", { name: "Gemini 7d 92.4% 余 ↻5d19h", exact: true })).toBeVisible();
    const state = strip.getByRole("img", { name: "idle", exact: true });
    const model = strip.getByTitle("Gemini 4 Argon high", { exact: true });
    const ring = strip.locator('[data-status-icon="context"]');
    await expect(ring).toHaveCSS("background-image", /87%/);
    await expect(strip.locator('[data-slot="statusline-divider"]')).toHaveCount(2);
    await expect(strip.getByText("余", { exact: true })).toHaveCount(2);
    const stateBox = await state.boundingBox();
    const modelBox = await model.boundingBox();
    const contextBox = await ring.locator("..").boundingBox();
    const coreBox = await strip.boundingBox();
    expect(stateBox!.x + stateBox!.width).toBeLessThan(modelBox!.x);
    expect(contextBox!.x + contextBox!.width).toBeLessThanOrEqual(coreBox!.x + coreBox!.width);
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
    await strip.getByRole("img", { name: "Gemini 5h 82.7% 余 ↻3h32m", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("agy-quota.png") });
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
      const hint = strip.getByRole("img", { name: state === "auto" ? "auto" : state === "idle" ? "? for shortcuts" : "esc to cancel", exact: true });
      const model = strip.getByTitle("Gemini 4 Argon medium", { exact: true });
      await expect(hint).toBeVisible();
      await expect(model).toBeVisible();
      const hintBox = await hint.boundingBox();
      const modelBox = await model.boundingBox();
      if (state === "auto") {
        expect(hintBox!.x).toBeGreaterThan(modelBox!.x + modelBox!.width);
      } else {
        expect(modelBox!.x).toBeGreaterThan(hintBox!.x + hintBox!.width);
      }
      await expect(page.getByText("Collie 未识别此界面", { exact: false })).toHaveCount(0);
      const input = page.getByRole("textbox").first();
      await expect(input).toBeEnabled();
      if (state === "auto") {
        await expect(input).toHaveValue("");
        await expect(strip.locator('[data-status-icon="context"][data-value="100"]')).toBeVisible();
        await expect(strip.getByText("v1.4.4", { exact: true })).toBeVisible();
        await expect(strip.getByText(/Σin|Σout/)).toHaveCount(0);
      }
      const stripBox = await strip.boundingBox();
      const inputBox = await input.boundingBox();
      expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(inputBox!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({ path: testInfo.outputPath(`agy-${state}.png`) });
    }
  });
}

test("AGY native startup, working and interrupted states retain their status mark", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "en");
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
  });
  await installApiStub(page);
  let state = "startup";
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "agy", status: state === "working" ? "working" : "idle", hasSession: false }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1", text: readFileSync(new URL(`../src/fixtures/panes/agy--v145-status-${state}--w120.txt`, import.meta.url), "utf8"), revision: 1,
  } }));
  for (state of ["startup", "working", "interrupted"]) {
    await page.goto("/pane/w1:p1");
    const strip = page.locator('[data-slot="agy-statusline"]');
    await expect(strip).toHaveCount(1);
    const mark = strip.getByRole("img", { name: state === "working" ? "working" : "idle", exact: true });
    await expect(mark).toBeVisible();
    const svg = mark.locator("svg");
    if (state === "working") {
      await expect(svg).toHaveCSS("animation-name", "statusline-hourglass");
      await expect(svg).toHaveCSS("animation-duration", "4.8s");
    } else {
      await expect(svg).toHaveCSS("animation-name", "none");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.screenshot({ path: testInfo.outputPath(`agy-native-${state}.png`) });
  }
});

for (const cols of [119, 50]) {
  test(`AGY artifact review menu replaces the unread warning: ${cols} columns`, async ({ page }, testInfo) => {
    const text = readFileSync(new URL(`../src/fixtures/panes/agy--v147-artifact-review--w${cols}.txt`, import.meta.url), "utf8");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "agy", status: "idle", hasSession: false }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
    for (const name of ["Approve", "Reject", "Preview", "Open", "Done", "Move up", "Move down"]) {
      const button = page.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
    }
    const strip = page.locator('[data-slot="agy-statusline"]');
    await expect(strip).toHaveCount(1);
    await expect(strip.getByRole("img", { name: "reviewing", exact: true })).toBeVisible();
    await expect(strip.getByText("Plan", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.screenshot({ path: testInfo.outputPath(`agy-artifact-review-w${cols}.png`) });
  });
}

test("AGY artifact detail viewer and reviewing composer keep their controls and statusline", async ({ page }, testInfo) => {
  const detailText = readFileSync(new URL("../src/fixtures/panes/agy--v147-artifact-detail--w119.txt", import.meta.url), "utf8");
  const idleReviewingText = readFileSync(new URL("../src/fixtures/panes/agy--v147-reviewing-idle--w119.txt", import.meta.url), "utf8");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "en");
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
  });
  await installApiStub(page);
  let text = detailText;
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "agy", status: "idle", hasSession: false }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1", text, revision: 1,
  } }));
  await page.goto("/pane/w1:p1");
  await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
  for (const name of ["Outline", "Hide lines", "Close", "Move up", "Move down"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
  const strip = page.locator('[data-slot="agy-statusline"]');
  await expect(strip).toHaveCount(1);
  await expect(strip.getByRole("img", { name: "idle", exact: true })).toBeVisible();
  await expect(strip.getByText("Plan", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("agy-artifact-detail.png") });

  text = idleReviewingText;
  await page.goto("/pane/w1:p1");
  await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
  await expect(strip).toHaveCount(1);
  await expect(strip.getByRole("img", { name: "reviewing", exact: true })).toBeVisible();
  await expect(strip.getByText("Plan", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox").first();
  await expect(input).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("agy-reviewing-idle.png") });
});

test("AGY /effort scale chips and /settings stacked controls render cleanly at 320px", async ({ page }, testInfo) => {
  const effortText = readFileSync(new URL("../src/fixtures/panes/agy--v147-effort--w119.txt", import.meta.url), "utf8");
  const settingsText = readFileSync(new URL("../src/fixtures/panes/agy--v147-settings--w119.txt", import.meta.url), "utf8");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "en");
    localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
  });
  await installApiStub(page);
  let text = effortText;
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "agy", status: "idle", hasSession: false }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1", text, revision: 1,
  } }));

  await page.goto("/pane/w1:p1");
  await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
  for (const name of ["Effort to low", "Effort to medium", "high, current", "Select", "Go back"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
  await expect(page.getByRole("button", { name: "high, current", exact: true })).toHaveAttribute("aria-current", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("agy-effort-w119.png") });

  text = settingsText;
  await page.goto("/pane/w1:p1");
  await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
  const moveUp = page.getByRole("button", { name: "Move up", exact: true });
  const changeLeft = page.getByRole("button", { name: "Left, Change (auto)", exact: true });
  await moveUp.scrollIntoViewIfNeeded();
  await changeLeft.scrollIntoViewIfNeeded();
  const upBox = await moveUp.boundingBox();
  const leftBox = await changeLeft.boundingBox();
  expect(leftBox!.y).toBeGreaterThanOrEqual(upBox!.y + upBox!.height);
  for (const name of ["Move up", "Move down", "Left, Change (auto)", "Right, Change (auto)", "Select", "Exit"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: testInfo.outputPath("agy-settings-w119.png") });
});

for (const cols of [119, 50]) {
  test(`AGY /usage Models & Quota panel lifts into a scrollable card with Close: ${cols} columns`, async ({ page }, testInfo) => {
    const text = readFileSync(new URL(`../src/fixtures/panes/agy--v147-usage--w${cols}.txt`, import.meta.url), "utf8");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("collie:locale:v1", "en");
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    });
    await installApiStub(page);
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "agy", status: "idle", hasSession: false }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text, revision: 1,
    } }));
    await page.goto("/pane/w1:p1");
    await expect(page.getByText("Collie did not recognize this interface", { exact: false })).toHaveCount(0);
    const card = page.getByRole("group", { name: "Models & Quota", exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByText("GEMINI MODELS", { exact: false })).toBeVisible();
    for (const name of ["Move up", "Move down", "Close"]) {
      const button = card.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
    }
    const strip = page.locator('[data-slot="agy-statusline"]');
    await expect(strip).toHaveCount(1);
    await expect(strip.getByRole("img", { name: "idle", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.screenshot({ path: testInfo.outputPath(`agy-usage-w${cols}.png`) });
  });
}
