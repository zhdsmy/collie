import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

import { en } from "@/lib/i18n/messages/en";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const paneId = "w2:p1";
const capture = readFileSync(
  join(import.meta.dirname, "..", "src", "fixtures", "panes", "cursor--idle-sanitized.txt"),
  "utf8",
);

test.beforeEach(async ({ page }) => {
  await installApiStub(page);
  await page.route(
    (url) => url.pathname === "/api/snapshot",
    (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...fixtureSnapshot,
        agents: fixtureSnapshot.agents.map((agent) =>
          agent.paneId === paneId ? Object.assign({}, agent, { agent: "cursor", status: "idle" }) : agent,
        ),
      }),
    }),
  );
  await page.route(
    (url) => decodeURIComponent(url.pathname) === `/api/pane/${paneId}`,
    (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ paneId, text: capture, truncated: false, revision: 1 }),
    }),
  );
});

test("Cursor pane keeps transcript readable and puts its controls under the thumb", async ({
  page,
}) => {
  await page.goto(`/pane/${paneId}`);

  const shortcuts = page.getByRole("group", { name: en["harnessBar.label"] });
  await expect(shortcuts).toBeVisible();
  for (const name of ["Model", "Summarize", "Resume"]) {
    await expect(shortcuts.getByRole("button", { name })).toBeVisible();
  }

  await expect(page.getByText("Upgrade the local tools and restart agents whose versions changed.")).toBeVisible();
  await expect(page.getByText("demo-service 1.2.3", { exact: false })).toBeVisible();
  await expect(page.getByText("demo-service 1.2.4", { exact: false })).toBeVisible();
  await expect(page.getByText("Auto Balance", { exact: false })).toBeVisible();
  await expect(page.getByText("Add a follow-up", { exact: false })).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
