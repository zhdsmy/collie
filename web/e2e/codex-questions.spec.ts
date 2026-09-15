import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { zh } from "@/lib/i18n/messages/zh";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

const fixture = (state: string) => readFileSync(new URL(
  `../src/fixtures/panes/codex--v0154-question-${state}.txt`, import.meta.url,
), "utf8");
const asyncFixture = (state: string) => readFileSync(new URL(
  `../src/fixtures/panes/codex--async-qa-${state}.txt`, import.meta.url,
), "utf8");
const asyncQuestion1 = "Choose the Collie QA layout for this isolated test.";
const question1 = "目前 Codex 的模型选择和状态栏命令是否一起改成直接打开对应选择界面，并保持原生对话中的全部选项和 说明？";
const question2 = "Which presentation should the question card use?";
const dictionaries = { en, zh };
/** Captured native screen reached after one allowed key in the current screen. */
type NativeTransitions = Record<string, Record<string, string>>;
function nextNativeState(transitions: NativeTransitions, state: string, key: string) {
  return transitions[state]?.[key];
}
test.use({ serviceWorkers: "block" });

for (const width of [320, 390]) {
  for (const theme of ["light", "dark"]) {
    for (const locale of ["en", "zh"] as const) {
      test(`Codex question correction: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
        const messages = dictionaries[locale];
        await page.setViewportSize({ width, height: 844 });
        await page.addInitScript((preferences) => {
          localStorage.setItem("collie:theme:v1", preferences.theme);
          localStorage.setItem("collie:locale:v1", preferences.locale);
        }, { theme, locale });
        await installApiStub(page);
        let state = "q1";
        const writes: string[][] = [];
        const transitions = {
          q1: { Down: "q1-selected" },
          "q1-selected": { Right: "q2-unanswered", "2": "q2" },
          "q2-unanswered": { Left: "q1-return" },
          "q1-return": { "2": "q2" },
          q2: { Left: "q1-answered", Down: "q2-selected" },
          "q1-answered": { Up: "q1-revised" },
          "q1-revised": { "1": "q2" },
          "q2-selected": { "2": "completed" },
        } satisfies NativeTransitions;
        await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
          ...fixtureSnapshot,
          agents: fixtureSnapshot.agents.map((agent, index) => index === 0
            ? Object.assign({}, agent, { agent: "codex", status: "blocked", hasSession: true }) : agent),
        } }));
        await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
          (route) => route.fulfill({ json: { paneId: "w1:p1", text: fixture(state), truncated: false, revision: 1 } }));
        await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
          // SAFETY: this route reads the app's own sendKeys payload; native transitions come only
          // from the captured sequence above, never from dynamically executing request content.
          const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
          writes.push(body.keys);
          expect(body.expected_prompt).toContain("Question ");
          expect(body.keys).toHaveLength(1);
          const next = nextNativeState(transitions, state, body.keys[0]!);
          expect(next, `unexpected ${body.keys.join()} in ${state}`).toBeDefined();
          if (next) state = next;
          return route.fulfill({ json: { ok: true } });
        });
        await page.goto("/pane/w1:p1");
        const first = page.getByRole("group", { name: question1, exact: true });
        const second = page.getByRole("group", { name: question2, exact: true });
        const previous = (panel: typeof first) => panel.getByRole("button", { name: messages["dialog.picker.previousQuestion"], exact: true });
        const next = (panel: typeof first) => panel.getByRole("button", { name: messages["dialog.picker.nextQuestion"], exact: true });
        const confirm = (panel: typeof first) => panel.getByRole("button", { name: messages["dialog.picker.submitAnswer"], exact: true });
        const submitAll = () => second.getByRole("button", { name: messages["dialog.picker.submitAll"], exact: true });
        await expect(first.getByText(question1, { exact: true })).toBeVisible();
        await expect(previous(first)).toBeDisabled();
        await expect(first.getByRole("textbox", { name: messages["dialog.picker.notes"], exact: true })).not.toBeFocused();
        await expect(first.getByRole("button", { name: messages["dialog.cancel"], exact: true })).toHaveCount(0);

        await first.getByRole("button", { name: /只优化打开后的界面/ }).click();
        await expect.poll(() => writes).toEqual([["Down"]]);
        // Merely browsing ahead must keep the final button locked while question 1 is unconfirmed.
        await next(first).click();
        await expect(second).toBeVisible();
        await expect(submitAll()).toBeDisabled();
        await expect(next(second)).toBeDisabled();
        await previous(second).click();
        await expect(first).toBeVisible();
        await confirm(first).click();
        await expect(second).toBeVisible();

        // Return to the committed answer, change it, then explicitly confirm the correction.
        await previous(second).click();
        await expect(first).toBeVisible();
        await first.getByRole("button", { name: /同步优化入口/ }).click();
        await expect.poll(() => state).toBe("q1-revised");
        await confirm(first).click();
        await expect(second).toBeVisible();
        await second.getByRole("button", { name: /Compact controls/ }).click();
        await expect.poll(() => state).toBe("q2-selected");
        await expect(submitAll()).toBeEnabled();
        await expect(page.getByText(messages["chat.status.selectionChanged"], { exact: true })).not.toBeVisible();
        if (locale === "zh" && width === 320) {
          await page.screenshot({ path: testInfo.outputPath(`question-${theme}.png`), fullPage: true });
        }
        await submitAll().click();
        await expect(second).toHaveCount(0);
        await expect(page.getByText(/Question test completed:/)).toBeVisible();
        expect(writes).toEqual([["Down"], ["Right"], ["Left"], ["2"], ["Left"], ["Up"], ["1"], ["Down"], ["2"]]);
      });
    }
  }
}

for (const { width, theme, locale } of [
  { width: 320, theme: "light", locale: "zh" },
  { width: 390, theme: "dark", locale: "en" },
] as const) {
  test(`Codex async questions: ${width} ${theme} ${locale}`, async ({ page }, testInfo) => {
    const messages = dictionaries[locale];
    const answer = "Remember blank lines\n\nKeep the card readable.";
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:theme:v1", preferences.theme);
      localStorage.setItem("collie:locale:v1", preferences.locale);
    }, { theme, locale });
    await installApiStub(page);

    let state = "collapsed";
    const writes: { keys: string[]; expected_prompt?: string }[] = [];
    const replies: { text: string; submit: boolean; expected_prompt?: string }[] = [];
    const transitions = {
      collapsed: { "alt+Up": "options" },
      options: { Down: "selected" },
      selected: { "alt+Up": "freeform" },
      "freeform-text": { Enter: "last" },
      last: { Enter: "completed" },
    } satisfies NativeTransitions;

    await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
      ...fixtureSnapshot,
      agents: fixtureSnapshot.agents.map((agent, index) => index === 0
        ? Object.assign({}, agent, { agent: "codex", status: "blocked", hasSession: true }) : agent),
    } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1",
      (route) => route.fulfill({ json: { paneId: "w1:p1", text: asyncFixture(state), truncated: false, revision: 1 } }));
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/reply", (route) => {
      // SAFETY: the route receives the app's sendReply payload; all fields are asserted below.
      const body = route.request().postDataJSON() as { text: string; submit: boolean; expected_prompt?: string };
      replies.push(body);
      expect(body.submit).toBe(false);
      expect(body.text).toBe(`\x1b[200~${answer}\x1b[201~`);
      expect(body.expected_prompt).toContain("What should the test remember?");
      expect(state).toBe("freeform");
      state = "freeform-text";
      return route.fulfill({ json: { ok: true } });
    });
    await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
      // SAFETY: the app's sendKeys payload is checked against the captured transition table.
      const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
      writes.push(body);
      expect(body.keys).toHaveLength(1);
      expect(body.expected_prompt).toEqual(expect.any(String));
      expect(body.expected_prompt).toContain(
        state === "collapsed" ? "Ask Codex to do anything" : "enter submit",
      );
      const next = nextNativeState(transitions, state, body.keys[0]!);
      expect(next, `unexpected ${body.keys.join()} in ${state}`).toBeDefined();
      if (next) state = next;
      return route.fulfill({ json: { ok: true } });
    });

    const noHorizontalOverflow = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    };

    await page.goto("/pane/w1:p1");
    const collapsed = page.getByRole("group", { name: messages["dialog.picker.async.title"], exact: true });
    await expect(collapsed).toBeVisible();
    await expect(collapsed.getByText(
      messages["dialog.picker.async.waiting.other"].replace("{count}", "2"),
      { exact: true },
    )).toBeVisible();
    await expect(collapsed.getByRole("button", {
      name: messages["dialog.picker.async.answer"],
      exact: true,
    })).toBeEnabled();
    await expect(collapsed.locator("textarea")).toHaveCount(0);
    await noHorizontalOverflow();
    await page.screenshot({ path: testInfo.outputPath(`async-${theme}-${locale}-collapsed.png`), fullPage: true });

    await collapsed.getByRole("button", {
      name: messages["dialog.picker.async.answer"],
      exact: true,
    }).click();
    await expect.poll(() => state).toBe("options");

    const options = page.getByRole("group", {
      name: asyncQuestion1,
      exact: true,
    });
    await expect(options).toBeVisible();
    await expect(options.getByRole("textbox", {
      name: messages["dialog.picker.async.customAnswer"],
      exact: true,
    })).not.toBeFocused();
    await noHorizontalOverflow();
    await options.getByRole("button", { name: /^Roomy cards/ }).click();
    await expect.poll(() => state).toBe("selected");
    await expect(options.getByRole("button", { name: /^Roomy cards/ })).toBeVisible();

    await options.getByRole("button", {
      name: messages["dialog.picker.nextQuestion"],
      exact: true,
    }).click();
    await expect.poll(() => state).toBe("freeform");

    const freeform = page.getByRole("group", {
      name: "What should the test remember? You may include blank lines.",
      exact: true,
    });
    await expect(freeform).toBeVisible();
    const customAnswer = freeform.getByRole("textbox", {
      name: messages["dialog.picker.async.customAnswer"],
      exact: true,
    });
    await expect(customAnswer).not.toBeFocused();
    await customAnswer.fill(answer);
    await expect(customAnswer).toHaveValue(answer);
    await noHorizontalOverflow();
    await page.screenshot({ path: testInfo.outputPath(`async-${theme}-${locale}-freeform.png`), fullPage: true });
    await freeform.getByRole("button", {
      name: messages["dialog.picker.submitAnswer"],
      exact: true,
    }).click();
    await expect.poll(() => replies).toHaveLength(1);
    await expect.poll(() => state).toBe("last");

    const last = page.getByRole("group", {
      name: asyncQuestion1,
      exact: true,
    });
    await expect(last).toBeVisible();
    await expect(last.getByRole("textbox", {
      name: messages["dialog.picker.async.customAnswer"],
      exact: true,
    })).toHaveValue("");
    await expect(last.getByRole("button", {
      name: messages["dialog.picker.submitAnswer"],
      exact: true,
    })).toBeEnabled();
    await noHorizontalOverflow();

    await last.getByRole("button", {
      name: messages["dialog.picker.submitAnswer"],
      exact: true,
    }).click();
    await expect.poll(() => state).toBe("completed");
    await expect(last).toHaveCount(0);
    await expect(page.getByRole("textbox").first()).toBeVisible();
    await expect(page.getByText(/error|failed|错误|失败/i)).toHaveCount(0);
    await noHorizontalOverflow();
    expect(writes.map(({ keys }) => keys)).toEqual([
      ["alt+Up"],
      ["Down"],
      ["alt+Up"],
      ["Enter"],
      ["Enter"],
    ]);
  });
}
