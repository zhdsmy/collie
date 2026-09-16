import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";
import entries from "@/fixtures/codex-plan-transcript.json" with { type: "json" };
import { installApiStub } from "./fixtures/api";

const fixture = (state: string) => readFileSync(new URL(
  `../src/fixtures/panes/codex--v0154-plan-${state}.txt`, import.meta.url,
), "utf8");
const dictionaries = { en, zh };
// Structural variant of captured native states; recap text is deliberately synthetic.
function snapshot(state: string, recap: boolean) {
  const text = fixture(state);
  if (!recap || !state.startsWith("short")) return text;
  const rows = text.split("\n");
  const title = rows.findIndex((row) => row.includes("Implement this plan?"));
  rows.splice(title, 0,
    "\u001b[2m────────────────────────────────\u001b[0m", "",
    "\u001b[2m──── \u001b[22;1mConversation recap\u001b[22;2m ────\u001b[0m", "",
    "Review the **scope** before implementation.", "",
    ...Array.from({ length: 30 }, (_, index) => `- Context note ${index + 1}: keep existing behavior.`), "",
  );
  return rows.join("\n");
}
test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) {
  for (const theme of ["light", "dark"]) {
    for (const locale of ["en", "zh"] as const) {
      for (const size of ["short", "long", "recap"]) {
        test(`Codex plan: ${size} ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
          const messages = dictionaries[locale];
          await page.setViewportSize({ width, height: 844 });
          await page.addInitScript((preferences) => {
            localStorage.setItem("collie:theme:v1", preferences.theme);
            localStorage.setItem("collie:locale:v1", preferences.locale);
          }, { theme, locale });
          await installApiStub(page);
          let state = size === "recap" ? "short" : size;
          const writes: string[][] = [];
          await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
            ...fixtureSnapshot,
            agents: fixtureSnapshot.agents.map((agent, index) => index === 0
              ? Object.assign({}, agent, { agent: "codex", status: "blocked", hasSession: true }) : agent),
          } }));
          await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
            (route) => route.fulfill({ json: { paneId: "w1:p1", text: snapshot(state, size === "recap"), truncated: false, revision: 1 } }));
          await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/history",
            // The short plan must render Markdown even without a matching journal entry.
            (route) => route.fulfill({ json: { available: size === "long", entries: size === "long" ? [entries[1]] : [], hasMore: false } }));
          await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
            // SAFETY: the app's own sendKeys payload is checked against captured native states.
            const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
            writes.push(body.keys);
            expect(body.expected_prompt).toContain("Implement this plan?");
            expect(body.expected_prompt).toMatch(/[Vv]erification/);
            expect(body.keys).toHaveLength(1);
            const key = body.keys[0];
            if (state === "short" && key === "Down") state = "short-second";
            else if (state === "short-second" && key === "Down") state = "short-third";
            else if (state === "short-third" && key === "Enter") state = "stayed";
            else if (state === "long" && key === "Enter") state = "implemented";
            else throw new Error(`Unexpected native transition: ${state} ${key}`);
            return route.fulfill({ json: { ok: true } });
          });
          await page.goto("/pane/w1:p1");
          const card = page.getByRole("group", { name: "Implement this plan?", exact: true });
          const content = card.getByRole("region", { name: messages["dialog.plan.body"] });
          const toggle = card.getByRole("button", { name: messages["dialog.plan.title"], exact: true });
          await expect(card).toBeVisible();
          await expect(page.getByRole("textbox")).not.toBeFocused();
          if (size === "recap") {
            const details = card.locator("details").filter({ hasText: messages["dialog.plan.recap"] });
            const summary = details.locator("summary");
            const recap = details.getByRole("region", { name: messages["dialog.plan.recap"] });
            await expect(details).not.toHaveAttribute("open");
            await summary.click();
            await expect(recap).toBeVisible();
            await expect(recap.locator("strong")).toHaveText("scope");
            await recap.getByText("Context note 30: keep existing behavior.", { exact: true }).scrollIntoViewIfNeeded();
            const rect = await recap.boundingBox();
            const action = await card.getByRole("button", { name: /Yes, implement this plan/ }).boundingBox();
            expect(rect!.y + rect!.height).toBeLessThanOrEqual(action!.y);
            expect(await recap.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
            await summary.click();
            await expect(details).not.toHaveAttribute("open");
          }
          await expect(card.getByText(messages["dialog.plan.partial"], { exact: true })).toHaveCount(0);
          if (size === "long") {
            await expect(content.getByText("Step 1: Opening section", { exact: true })).toBeVisible();
            const ending = content.getByText("Final verification", { exact: true });
            await ending.scrollIntoViewIfNeeded();
            await expect(content.getByText("Step 24: Preserve plan content", { exact: true })).toBeVisible();
          } else {
            await expect(content.getByText("Codex plan card", { exact: true })).toBeVisible();
            await expect(content.getByRole("list")).toBeVisible();
            await expect(content.getByText('const action = "review before implementation";', { exact: false })).toBeVisible();
          }
          await toggle.click();
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await expect(content).toHaveCount(0);
          await expect(card.getByRole("button", { name: /Yes, clear context and implement/ })).toBeVisible();
          await toggle.click();
          await expect(content).toBeVisible();
          await expect.poll(() => content.evaluate((element) => element.parentElement!.getBoundingClientRect().height)).toBeGreaterThan(80);
          if (locale === "zh" && width === 320) {
            await page.screenshot({ path: testInfo.outputPath(`plan-${size}-${theme}.png`), fullPage: true, animations: "disabled" });
          }
          await card.getByRole("button", { name: size === "long" ? /Yes, implement this plan/ : /No, stay in Plan mode/ }).click();
          await expect(card).toHaveCount(0);
          expect(writes).toEqual(size === "long" ? [["Enter"]] : [["Down"], ["Down"], ["Enter"]]);
        });
      }
    }
  }
}
