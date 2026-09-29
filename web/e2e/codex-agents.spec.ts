import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "../src/test/handlers";
import { en } from "../src/lib/i18n/messages/en";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}.txt`, import.meta.url), "utf8");
const first = "Earlier terminal output\n" + fixture("codex--v0158-agents-overview");
const moved = "Earlier terminal output\n" + fixture("codex--v0158-agents-overview-moved");
const idle = fixture("codex--v0157-idle");
test.use({ serviceWorkers: "block" });

test("Codex command center selects and cancels safely at 320px", async ({ page }, testInfo) => {
  let text = first;
  const keys: string[][] = [];
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
  await installApiStub(page);
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "codex", status: "idle", hasSession: true }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({
    json: { paneId: "w1:p1", text, truncated: false, revision: 1 },
  }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
    // SAFETY: the app's native key payload is bound to the visible command center before every write.
    const body = route.request().postDataJSON() as { keys: string[]; expected_prompt: string };
    expect(body.expected_prompt).toContain("Agent command center");
    if (body.keys[0] === "Down") {
      expect(text).toBe(first);
      text = moved;
    } else {
      expect(body.keys).toEqual(keys.length === 1 ? ["Enter"] : ["Escape"]);
      if (body.keys[0] === "Enter") expect(body.expected_prompt).toContain("› ! Fixture beta");
      text = idle;
    }
    keys.push(body.keys);
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/pane/w1:p1");
  const panel = page.getByRole("group", { name: "Agent command center", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-slot="picker-options"] button')).toHaveCount(2);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("codex-agents-320.png"), fullPage: true });
  const input = page.getByRole("textbox").first();
  await input.fill("Fixture draft");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(en["composer.status.dialogWaiting"], { exact: true })).toBeVisible();
  await expect(input).toHaveValue("Fixture draft");
  await input.fill("");
  await panel.getByRole("button", { name: /^Fixture beta / }).click();
  await expect(panel).toHaveCount(0);
  expect(keys).toEqual([["Down"], ["Enter"]]);
  await expect(page.getByRole("textbox").first()).toBeEnabled();

  text = first;
  await page.reload();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: en["dialog.cancel"], exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect(keys).toEqual([["Down"], ["Enter"], ["Escape"]]);
});

test("Codex agents scroll within five rows and require explicit delete confirmation", async ({ page }, testInfo) => {
  const list = fixture("codex--v0158-agents-overview-six");
  const centeredList = list
    .replace("  \u001b[0m\u001b[1m\u001b[7m› ○ Fixture zeta", "    ○ Fixture zeta")
    .replace("    ○ Fixture beta                                   Ready", "  \u001b[1m› ○ Fixture beta                         current   Ready");
  const help = fixture("codex--v0158-agents-overview-help");
  const confirmation = fixture("codex--v0158-agents-overview-delete");
  const pointed = fixture("codex--v0158-agents-overview-delete-pointed");
  const deleted = fixture("codex--v0158-agents-overview-deleted");
  let text = list;
  const keys: string[][] = [];
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
  await installApiStub(page);
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "codex", status: "idle", hasSession: true }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({
    json: { paneId: "w1:p1", text, truncated: false, revision: 1 },
  }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
    // SAFETY: this mock accepts only the bound native keys asserted below.
    const body = route.request().postDataJSON() as { keys: string[]; expected_prompt: string };
    expect(body.expected_prompt).toContain(text.includes("Permanently delete") ? "Permanently delete" : "Agent command center");
    if (body.keys[0] === "?") { expect(text).toBe(list); text = help; }
    else if (body.keys[0] === "Escape") { expect([help, confirmation]).toContain(text); text = list; }
    else if (body.keys[0] === "Backspace") { expect(text).toBe(list); text = confirmation; }
    else if (body.keys[0] === "Down") { expect(text).toBe(confirmation); text = pointed; }
    else { expect(body.keys).toEqual(["Enter"]); expect(text).toBe(pointed); text = deleted; }
    keys.push(body.keys);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/pane/w1:p1");
  const panel = page.getByRole("group", { name: "Agent command center", exact: true });
  const options = panel.locator('[data-slot="picker-options"]');
  await expect(options.locator("button")).toHaveCount(6);
  const geometry = await options.evaluate((element) => {
    const rows = Array.from(element.children);
    const five = rows.slice(0, 5);
    return { height: element.clientHeight, scrollHeight: element.scrollHeight,
      fiveHeight: five.at(-1)!.getBoundingClientRect().bottom - five[0]!.getBoundingClientRect().top };
  });
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.height);
  expect(Math.abs(geometry.height - geometry.fiveHeight)).toBeLessThan(1);
  const remove = panel.getByRole("button", { name: "Delete Fixture zeta", exact: true });
  await expect(remove).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("codex-agents-scroll-320.png"), fullPage: true });
  text = centeredList;
  await page.reload();
  await expect(panel.getByRole("button", { name: "Delete Fixture beta", exact: true })).toBeVisible();
  await expect.poll(() => options.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    const row = element.querySelector('[data-pointed="true"]')!.getBoundingClientRect();
    return Math.abs((row.top + row.bottom - frame.top - frame.bottom) / 2);
  })).toBeLessThan(1);
  await page.screenshot({ path: testInfo.outputPath("codex-agents-centered-320.png"), fullPage: true });
  await page.setViewportSize({ width: 430, height: 932 });
  const phoneList = await options.evaluate((element) => {
    const rows = Array.from(element.children);
    return { height: element.clientHeight,
      fiveHeight: rows[4]!.getBoundingClientRect().bottom - rows[0]!.getBoundingClientRect().top };
  });
  expect(Math.abs(phoneList.height - phoneList.fiveHeight)).toBeLessThan(1);
  await page.screenshot({ path: testInfo.outputPath("codex-agents-centered-430.png"), fullPage: true });
  text = list;
  await page.setViewportSize({ width: 320, height: 844 });
  await page.reload();
  await expect(remove).toBeVisible();
  await options.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(options.getByRole("button", { name: /^Fixture alpha / })).toBeInViewport();
  await expect(remove).toBeInViewport();
  await remove.click();
  const confirm = page.getByRole("group", { name: "Permanently delete “Fixture zeta”?", exact: true });
  await expect(confirm).toBeVisible();
  expect(keys).toEqual([["?"], ["Escape"], ["Backspace"]]);
  await confirm.locator('[data-slot="prompt-actions"]').getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(panel).toBeVisible();
  expect(text).toBe(list);
  await remove.click();
  await confirm.getByRole("button", { name: "Permanently delete task and child agents", exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(options.locator("button")).toHaveCount(5);
  expect(keys.slice(-2)).toEqual([["Down"], ["Enter"]]);
  expect(text).toBe(deleted);
  await page.setViewportSize({ width: 1280, height: 1080 });
  await expect(options).toBeVisible();
  const fullList = await options.evaluate((element) => {
    const rows = Array.from(element.children);
    return { height: element.clientHeight,
      fiveHeight: rows.at(-1)!.getBoundingClientRect().bottom - rows[0]!.getBoundingClientRect().top };
  });
  expect(Math.abs(fullList.height - fullList.fiveHeight)).toBeLessThan(1);
  await expect(remove).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Delete Fixture delta", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("codex-agents-scroll-desktop.png"), fullPage: true });
});
