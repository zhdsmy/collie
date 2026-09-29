import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { en } from "../src/lib/i18n/messages/en";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}.txt`, import.meta.url), "utf8");
test.use({ serviceWorkers: "block" });

test("Claude agents traverse headings, open, cancel and scroll within five rows at 320px", async ({ page }, testInfo) => {
  const list = fixture("claude--v21284-agents-list");
  const header = fixture("claude--v21284-agents-working-header");
  const idle = fixture("claude--fresh-idle");
  let text = "Earlier conversation\n" + header;
  const keys: string[][] = [];
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
  await installApiStub(page);
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({
    json: { paneId: "w1:p1", text, truncated: false, revision: 1 },
  }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
    // SAFETY: the mock accepts only the native navigation and commit keys asserted here.
    const body = route.request().postDataJSON() as { keys: string[]; expected_prompt: string };
    expect(body.expected_prompt).toContain("Claude Code");
    if (body.keys[0] === "Up") { expect(text).toContain("? for shortcuts"); text = list; }
    else {
      expect(body.keys).toEqual([keys.length === 1 ? "Enter" : "Escape"]);
      if (body.keys[0] === "Enter") expect(text).toBe(list);
      text = idle;
    }
    keys.push(body.keys);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/pane/w1:p1");
  const card = page.getByRole("group", { name: "Agents", exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByText("Earlier conversation", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: /^Fixture alpha / }).click();
  await expect(card).toHaveCount(0);
  expect(keys).toEqual([["Up"], ["Enter"]]);

  // Synthetic six-session list built from the sanitized native row paint.
  const rows = list.split("\n");
  const at = rows.findIndex((row) => row.includes("Fixture alpha"));
  const unselected = fixture("claude--v21284-agents-header").split("\n").find((row) => row.includes("Fixture alpha"))!;
  rows.splice(at, 1, ...Array.from({ length: 6 }, (_, i) =>
    (i === 3 ? rows[at]! : unselected).replace("Fixture alpha", `Fixture ${i + 1}`.padEnd(13))));
  text = rows.join("\n").replace("1 awaiting input", "6 awaiting input");
  await page.reload();
  await expect(card).toBeVisible();
  const options = card.locator('[data-slot="picker-options"]');
  await expect(options.getByRole("button")).toHaveCount(6);
  const geometry = await options.evaluate((node) => {
    const items = Array.from(node.children);
    return { height: node.clientHeight, content: node.scrollHeight,
      five: items[4]!.getBoundingClientRect().bottom - items[0]!.getBoundingClientRect().top,
      gap: node.getBoundingClientRect().right - items[0]!.getBoundingClientRect().right };
  });
  expect(geometry.content).toBeGreaterThan(geometry.height);
  expect(Math.abs(geometry.height - geometry.five)).toBeLessThan(1);
  expect(geometry.gap).toBeGreaterThanOrEqual(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => options.evaluate((node) => {
    const frame = node.getBoundingClientRect();
    const row = node.querySelector('[data-pointed="true"]')!.getBoundingClientRect();
    return Math.abs((row.top + row.bottom - frame.top - frame.bottom) / 2);
  })).toBeLessThan(1);
  await page.screenshot({ path: testInfo.outputPath("claude-agents-320.png") });
  await card.locator('[data-slot="prompt-actions"]').getByRole("button", { name: en["dialog.cancel"], exact: true }).click();
  await expect(card).toHaveCount(0);
  expect(keys).toEqual([["Up"], ["Enter"], ["Escape"]]);
});
