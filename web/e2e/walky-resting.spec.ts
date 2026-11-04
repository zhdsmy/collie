import { expect, test } from "@playwright/test";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

for (const wake of [false, true]) {
  test(`Walky resting sessions at 320px: wake=${wake}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
    await installApiStub(page);
    const resting = { address: "workshop/w2:p1", memberId: "workshop", machine: "workshop", harness: "codex", label: "resting-session", state: "done" };
    await page.route("**/api/walky/who", (route) => route.fulfill({ json: {
      targets: [{ address: "bluefin/w1:p1", memberId: "bluefin", machine: "bluefin", harness: "claude", label: "active-session", state: "idle" }, resting],
      skipped: [{ ...resting, reason: "resting" }],
    } }));
    const posts: { wake?: boolean }[] = [];
    await page.route("**/api/walky", async (route) => {
      const body = route.request().postDataJSON();
      posts.push(body);
      await route.fulfill({ json: { receipts: [{ id: body.id, target: resting.address, by: "workshop", state: wake ? "delivered" : "inbox-only", reason: wake ? undefined : "resting", verified: "local", at: Date.now() }] } });
    });
    await page.goto("/crew");
    await page.getByRole("button", { name: "Message all agents", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Message all agents", exact: true });
    await expect(dialog.getByText("Resting, not woken", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Agents reached: 1", { exact: true })).toBeVisible();
    const toggle = dialog.getByRole("switch", { name: "Wake them too", exact: true });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    if (wake) {
      await toggle.click();
      await expect(dialog.getByText("Agents reached: 2", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Resting, woken too", { exact: true })).toBeVisible();
    }
    await dialog.getByRole("textbox", { name: "Message", exact: true }).fill("Report status");
    await dialog.getByRole("button", { name: "Send message", exact: true }).click();
    expect(posts).toHaveLength(0);
    await expect(dialog.getByRole("group", { name: wake ? "Message 2 agents on 2 machines?" : "Message 1 agent on 1 machine?", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("walky-resting-320.png"), animations: "disabled" });
    await dialog.getByRole("button", { name: "Send", exact: true }).click();
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]?.wake === true).toBe(wake);
    await expect(dialog.locator('[data-slot="walky-receipts"]')).toBeVisible();
  });
}
