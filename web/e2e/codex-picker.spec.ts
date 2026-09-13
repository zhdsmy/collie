import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { en } from "@/lib/i18n/messages/en";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";

import { installApiStub } from "./fixtures/api";

type Locale = "en" | "zh";

interface PickerScenario {
  name: string;
  file: string;
  title: string;
  kind: "single" | "multiple";
  labels: readonly string[];
  optionCount: number;
  preview: boolean;
  search: boolean;
}

const fixture = (name: string): string =>
  readFileSync(new URL(`../src/fixtures/panes/codex--v0154-picker-${name}.txt`, import.meta.url), "utf8");

const scenarios: readonly PickerScenario[] = [
  {
    name: "model",
    file: "model",
    title: "Select Model and Effort",
    kind: "single",
    labels: ["gpt-6-astra", "gpt-5.6-luna", "gpt-5.2"],
    optionCount: 6,
    preview: false,
    search: false,
  },
  {
    name: "effort",
    file: "effort",
    title: "Select Reasoning Level for gpt-6-astra",
    kind: "single",
    labels: ["Low", "Medium", "Extra high"],
    optionCount: 5,
    preview: false,
    search: false,
  },
  {
    name: "advanced",
    file: "advanced",
    title: "Advanced Reasoning",
    kind: "single",
    labels: ["Max", "Ultra"],
    optionCount: 2,
    preview: false,
    search: false,
  },
  {
    name: "statusline",
    // This capture immediately precedes the search capture; its selected items/preview agree.
    file: "statusline-toggled",
    title: "Configure Status Line",
    kind: "multiple",
    labels: ["Use theme colors", "model-with-reasoning", "context-remaining", "project-name"],
    optionCount: 7,
    preview: true,
    search: true,
  },
  {
    name: "statusline search",
    file: "statusline-search",
    title: "Configure Status Line",
    kind: "multiple",
    labels: ["context-remaining", "context-used", "context-window-size"],
    optionCount: 3,
    preview: true,
    search: true,
  },
  {
    name: "statusline empty",
    file: "statusline-empty",
    title: "Configure Status Line",
    kind: "multiple",
    labels: [],
    optionCount: 0,
    preview: true,
    search: true,
  },
];

const dictionaries = { en, zh } as const;

function dictionary(locale: Locale) {
  return dictionaries[locale];
}

test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) {
  for (const theme of ["light", "dark"] as const) {
    for (const locale of ["en", "zh"] as const) {
      for (const scenario of scenarios) {
        test(`Codex picker ${scenario.name}: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height: 844 });
          await page.addInitScript((preferences) => {
            localStorage.setItem("collie:theme:v1", preferences.theme);
            localStorage.setItem("collie:locale:v1", preferences.locale);
          }, { theme, locale });
          await installApiStub(page);

          let current = fixture(scenario.file);
          const searchWrites: { text?: string; submit?: boolean }[] = [];
          const searchResult = fixture("statusline-search");

          await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
            ...fixtureSnapshot,
            agents: fixtureSnapshot.agents.map((agent, index) => index === 0
              ? Object.assign({}, agent, { agent: "codex", status: "working", hasSession: true })
              : agent),
          } }));
          await page.route(
            (url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
            (route) => route.fulfill({ json: {
              paneId: "w1:p1",
              text: current,
              truncated: false,
              revision: 1,
            } }),
          );
          await page.route(
            (url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/reply",
            (route) => {
              // SAFETY: the app's sendReply contract is `{ text, submit }`; this route only records
              // that own request and never treats arbitrary input as executable data.
              const body = route.request().postDataJSON() as { text?: string; submit?: boolean };
              searchWrites.push(body);
              if (body.submit === false && body.text === "context") current = searchResult;
              return route.fulfill({ json: { ok: true } });
            },
          );

          await page.goto("/pane/w1:p1");

          const panel = page.getByRole("group", { name: scenario.title, exact: true });
          await expect(panel).toBeVisible();

          if (scenario.kind === "single") {
            await expect(panel.getByRole("button")).toHaveCount(scenario.optionCount + 3);
            for (const label of scenario.labels) {
              await expect(panel.getByRole("button", { name: new RegExp(label) })).toBeVisible();
            }
          } else {
            await expect(panel.getByRole("checkbox")).toHaveCount(scenario.optionCount);
            const reorderButtons = panel.getByRole("button", {
              name: /Move .* (?:up|down)|(?:上移|下移)/i,
            });
            if (scenario.optionCount > 0) await expect(reorderButtons.first()).toBeVisible();
            for (const label of scenario.labels) {
              await expect(panel.getByRole("checkbox", { name: new RegExp(label) })).toBeVisible();
            }
          }

          if (scenario.search) {
            const messages = dictionary(locale);
            const search = panel.getByRole("searchbox", { name: messages["dialog.picker.searchAria"] });
            await expect(search).toBeVisible();
            await expect(panel.getByRole("button", {
              name: messages["dialog.picker.apply"],
              exact: true,
            })).toBeVisible();
          }

          if (scenario.preview) {
            await expect(panel.getByRole("region", {
              name: dictionary(locale)["dialog.picker.previewAria"],
            })).toBeVisible();
          }

          const footer = panel.getByRole("note", {
            name: dictionary(locale)["dialog.picker.footerAria"],
          });
          await expect(footer).toBeVisible();

          if (scenario.name === "statusline empty") {
            await expect(panel.getByText(dictionary(locale)["dialog.picker.noResults"], { exact: true })).toBeVisible();
          }

          if (scenario.name === "statusline") {
            const messages = dictionary(locale);
            const search = panel.getByRole("searchbox", { name: messages["dialog.picker.searchAria"] });
            await search.fill("context");
            await panel.getByRole("button", {
              name: messages["dialog.picker.apply"],
              exact: true,
            }).click();
            await expect.poll(() => searchWrites.length, { timeout: 8_000 }).toBe(1);
            expect(searchWrites[0]).toMatchObject({ text: "context", submit: false });
            await expect(panel.getByRole("checkbox", { name: /context-window-size/ })).toBeVisible();
            await expect(page.getByText(messages["chat.status.selectionChanged"], { exact: true })).not.toBeVisible();
          }

          if (width === 320 && theme === "dark" && locale === "zh" && scenario.name === "statusline") {
            await page.screenshot({ path: testInfo.outputPath("codex-picker.png"), fullPage: true });
          }
        });
      }
    }
  }
}
