import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

// The mode row as the captures paint it: the mode run pink, the hint grey, both behind the input box.
const pane = readFileSync(new URL("../src/fixtures/panes/claude--draft-footer-single.txt", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../src/fixtures/panes/claude--permission-edit.txt", import.meta.url), "utf8");
const cycled = pane.replace("bypass permissions on", "accept edits on");

test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) test(`claude mode tap: ${width}`, async ({ page }, testInfo) => {
  let current = pane;
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
  await installApiStub(page);
  let sentKeys: unknown[][] = [];
  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "claude", status: "working" }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1", text: current, revision: 1, truncated: false,
  } }));
  await page.route("**/api/pane/*/keys", async (route) => {
    // SAFETY: the route above fulfils every /api/pane request with our own `{keys, expected_prompt}`
    // body, so the parsed POST is that shape and nothing else.
    const body = await route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
    sentKeys.push([body.keys, body.expected_prompt]);
    // The mode moved, so the next poll reads the cycled capture.
    current = cycled;
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/pane/w1:p1");
  const button = page.getByRole("button", { name: /Claude mode: ⏵⏵ bypass permissions on/ });
  await expect(button).toBeVisible();

  // The terminal's own hint text is gone, replaced by the two keys it named (drawn as icons).
  await expect(page.getByText("shift+tab to cycle")).toHaveCount(0);
  // The rest of the row survives verbatim.
  await expect(page.getByText("← 1 agent")).toBeVisible();
  await expect(button).toBeEnabled(); // working is NOT a refusal for this control
  await button.click();

  await expect(page.getByText("Claude mode: ⏵⏵ accept edits on")).toBeVisible();
  expect(sentKeys).toHaveLength(1);
  expect(sentKeys[0]![0]).toEqual(["shift+tab"]);
  // The binding is the composer through the buffer's tail — the bridge's six-row window.
  expect(String(sentKeys[0]![1])).toContain("⏵⏵ bypass permissions on");
  expect(String(sentKeys[0]![1])).toContain("← 1 agent");
  // The read-back confirms, and the success line names the new mode.
  await expect(page.getByText("Claude mode: ⏵⏵ accept edits on")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("claude-mode.png") });

  // With a permission dialog up, the control does not exist at all: shift+tab ANSWERS that dialog.
  current = dialog;
  await page.reload();
  await expect(page.getByRole("button", { name: /Claude mode/ })).toHaveCount(0);
});
