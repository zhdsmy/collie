import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { installApiStub } from "./fixtures/api";
import { fixtureSnapshot, sendAnswer } from "../src/test/handlers";

test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installApiStub(page);
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "en");
    if (!localStorage.getItem("collie:dash-prefs:v1")) {
      localStorage.setItem("collie:dash-prefs:v1", JSON.stringify({ paneView: "terminal" }));
    }
  });
  const text = readFileSync(new URL("../src/fixtures/panes/codex--v0165-ultra-empty--w120.txt", import.meta.url), "utf8");
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0 ? Object.assign({}, agent, { agent: "codex", status: "idle" }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) =>
    route.fulfill({ json: { paneId: "w1:p1", text, truncated: false, revision: 1 } }));
});

test("one touch sends once and busy Send keeps the field focused", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const sent: string[] = [];
  await page.route("**/api/send", async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body.text);
    await gate;
    await route.fulfill({ json: sendAnswer(body.id, "sent") });
  });
  try {
    await page.goto("/pane/w1:p1");
    const input = page.getByRole("textbox").first();
    const send = page.locator('[data-slot="composer-primary"]');
    await input.fill("first touch");
    await send.tap();
    await expect.poll(() => sent).toEqual(["first touch"]);
    await expect(send).toHaveAttribute("aria-disabled", "true");
    await expect(input).toBeFocused();
    // Playwright otherwise waits for aria-disabled to clear instead of touching the busy control.
    await send.tap({ force: true });
    await expect(input).toBeFocused();
    expect(sent).toEqual(["first touch"]);
    release();
    await expect(input).toHaveValue("");
    await expect(send).not.toHaveAttribute("aria-disabled");
    await page.screenshot({ path: info.outputPath("send-focus-320.png"), animations: "disabled" });
  } finally {
    release();
  }
});

test("Zoom pill can be turned off and the device choice survives reload", async ({ page }, info) => {
  await page.goto("/pane/w1:p1");
  await expect(page.getByRole("button", { name: "Zoom output" })).toBeVisible();
  await page.goto("/settings/appearance");
  const choices = page.getByRole("radiogroup", { name: "Zoom pill" });
  await choices.getByRole("radio", { name: "Off", exact: true }).click();
  await page.reload();
  await expect(choices.getByRole("radio", { name: "Off", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.goto("/pane/w1:p1");
  await expect(page.getByRole("button", { name: "Zoom output" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("zoom-off-320.png"), animations: "disabled" });
});
