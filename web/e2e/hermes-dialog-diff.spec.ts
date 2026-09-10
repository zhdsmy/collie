import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "@/test/handlers";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/hermes--${name}.txt`, import.meta.url), "utf8");
const q0 = fixture("clarify-q0"), q1 = fixture("clarify-q1"), other = fixture("clarify-other");
const done = fixture("done"), diff = fixture("diff");
test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) for (const theme of ["light", "dark"]) {
  test(`Hermes native choices and diff rectangles: ${width} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((selectedTheme) => {
      localStorage.setItem("collie:theme:v1", selectedTheme);
      localStorage.setItem("collie:locale:v1", "zh");
    }, theme);
    await installApiStub(page);
    let current = q0;
    const writes: { keys: string[]; expected_prompt: string }[] = [];
    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, i) => i === 0
        ? Object.assign({}, agent, { agent: "hermes", status: current === done ? "done" : "blocked", hasSession: true })
        : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
      paneId: "w1:p1", text: diff + current, truncated: false, revision: 1,
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: this is the app's typed API request, driven only by the mocked native choice buttons.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt: string };
      writes.push(body);
      current = current === q0 ? q1 : other;
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    const choice = page.getByRole("button", { name: /显示摘要/ });
    await expect(choice).toBeVisible();
    await expect(page.getByText("example-model", { exact: true })).toBeVisible();
    const optionsFit = await page.getByRole("button", { name: /检查示例|显示摘要|验证红绿背景|Other \(type your answer\)/ }).evaluateAll((els) => els.every((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= document.documentElement.clientWidth && box.height > 0
        && el.scrollWidth <= el.clientWidth;
    }));
    expect(optionsFit).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("choices.png") });
    await choice.click();
    await expect(page.getByRole("button", { name: /Markdown/ })).toBeVisible();
    expect(writes[0]!.keys).toEqual(["2"]);
    expect(writes[0]!.expected_prompt).toContain("选择测试方案？");
    await page.getByRole("button", { name: /Other \(type your answer\)/ }).click();
    await expect(page.getByRole("button", { name: /Markdown/ })).toHaveCount(0);
    expect(writes[1]!.keys).toEqual(["3"]);
    await expect(page.getByRole("textbox").first()).toBeEnabled();

    current = done;
    await page.reload();
    const changes = page.getByText(/^[+-] (?:Old sample|A second deleted|New sample|A second added)/);
    await expect(changes).toHaveCount(4);
    const geometry = await changes.evaluateAll((els) => els.map((el) => {
      let row = el;
      while (row.parentElement && !row.hasAttribute("data-terminal-surface")) row = row.parentElement;
      const box = row.getBoundingClientRect();
      const mirror = row.closest("pre")!.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        mirrorLeft: mirror.left, mirrorRight: mirror.right, color: getComputedStyle(row).backgroundColor };
    }));
    for (const box of geometry) {
      expect(box.left).toBe(box.mirrorLeft);
      expect(box.right).toBe(box.mirrorRight);
      expect(Math.round(box.left)).toBe(Math.round(width - box.right));
    }
    expect(geometry.map((box) => box.color)).toEqual([
      "rgb(74, 34, 29)", "rgb(74, 34, 29)", "rgb(33, 58, 43)", "rgb(33, 58, 43)",
    ]);
    expect(geometry[0]!.bottom).toBe(geometry[1]!.top);
    expect(geometry[2]!.bottom).toBe(geometry[3]!.top);
    await changes.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("diff.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(() => localStorage.setItem("collie:display-prefs:v4", JSON.stringify({ rawTerminal: true })));
    await page.reload();
    const raw = await page.getByText(/^- Old sample/).evaluate((el) => {
      let parent = el.parentElement;
      while (parent) {
        if (parent.hasAttribute("data-terminal-surface")) return false;
        parent = parent.parentElement;
      }
      return true;
    });
    expect(raw).toBe(true);
  });
}
