import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot } from "../src/test/handlers";
import { en } from "../src/lib/i18n/messages/en";

const fixture = (name: string) => readFileSync(new URL(`../src/fixtures/panes/${name}.txt`, import.meta.url), "utf8");
const first = fixture("codex--v0158-agents-overview");
const moved = fixture("codex--v0158-agents-overview-moved");
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
  await expect(page.getByRole("textbox")).toHaveCount(0);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("codex-agents-320.png"), fullPage: true });
  await panel.getByRole("button", { name: "Fixture beta", exact: true }).click();
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
