import { expect, test } from "@playwright/test";
import { en } from "@/lib/i18n/messages/en";
import { de } from "@/lib/i18n/messages/de";
import { zh } from "@/lib/i18n/messages/zh";
import { installApiStub } from "./fixtures/api";

const dictionaries = { en, de, zh };
test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) for (const locale of ["en", "de", "zh"] as const) {
  test(`merged Input: ${theme} ${locale}`, async ({ page }, testInfo) => {
    const messages = dictionaries[locale];
    await page.setViewportSize({ width: theme === "light" ? 430 : 320, height: 932 });
    await page.addInitScript((preferences) => {
      localStorage.setItem("collie:locale:v1", preferences.locale);
      localStorage.setItem("collie:theme:v1", preferences.theme);
    }, { locale, theme });
    await installApiStub(page);
    const sent: string[] = [];
    await page.route("**/api/pane/*/keys*", async (route) => {
      const body = route.request().postDataJSON();
      sent.push(...body.keys);
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    const controls = page.getByRole("group", { name: messages["composer.controls.label"] });
    await expect(controls.getByRole("button")).toHaveCount(4);
    await expect(controls.getByRole("button", { name: messages["composer.controls.keys"], exact: true })).toHaveCount(0);
    const input = controls.getByRole("button", { name: messages["composer.controls.typeAria"] });
    await input.tap();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    const textarea = page.getByRole("textbox");
    await expect(textarea).not.toBeFocused();
    const accessory = page.getByTestId("direct-keyboard-accessory");
    await expect(accessory).toBeInViewport();
    await expect.poll(() => accessory.evaluate((el) =>
      getComputedStyle(el.closest('[data-slot="collapse"]')!).overflowY,
    )).toBe("visible");
    const keysBox = await accessory.boundingBox();
    const actionsBox = await page.locator('[data-slot="composer-actions"]').boundingBox();
    const inputBox = await textarea.boundingBox();
    expect(keysBox!.y).toBeGreaterThanOrEqual(actionsBox!.y + actionsBox!.height);
    expect(keysBox!.y + keysBox!.height).toBeLessThanOrEqual(inputBox!.y);
    await accessory.getByRole("button", { name: "Ctrl", exact: true }).tap();
    await expect(accessory.getByRole("button", { name: "Ctrl", exact: true })).toHaveAttribute("data-mode", "once");
    await accessory.getByRole("button", { name: "Tab", exact: true }).tap();
    await expect.poll(() => sent).toEqual(["ctrl+Tab"]);
    await expect(textarea).not.toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("input-navigation.png") });
    await textarea.tap();
    await expect(textarea).toBeFocused();
    await accessory.getByRole("button", { name: "Escape", exact: true }).tap();
    await expect(textarea).toBeFocused();
    for (const name of ["Ctrl", "Shift", "Alt"]) await accessory.getByRole("button", { name, exact: true }).tap();
    await accessory.getByRole("button", { name: messages["keys.showComboKeys"] }).tap();
    // The combos page has no modifier keys, so the switch carries the latched ones: at their widest
    // here, and still clear of the icon and the page dots, inside the button.
    const carrying = accessory.getByRole("button", {
      name: `${messages["keys.showFunctionKeys"]} · Ctrl+Alt+Shift`,
    });
    await expect(carrying).toHaveText("^⌥⇧");
    const tagFit = await carrying.getByText("^⌥⇧").evaluate((tag) => {
      const box = tag.getBoundingClientRect();
      const button = tag.closest("button")!.getBoundingClientRect();
      const covered = [...tag.closest("button")!.querySelectorAll("svg, span:empty")].filter((part) => {
        const r = part.getBoundingClientRect();
        return r.left < box.right && box.left < r.right && r.top < box.bottom && box.top < r.bottom;
      });
      const inside = box.left >= button.left && box.right <= button.right && box.top >= button.top;
      return { covered: covered.length, inside };
    });
    expect(tagFit).toEqual({ covered: 0, inside: true });
    await page.screenshot({ path: testInfo.outputPath("input-combos.png") });
    await carrying.tap();
    const rail = page.getByTestId("direct-key-rail");
    await rail.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await expect(accessory.getByRole("button", { name: "F12", exact: true })).toBeInViewport();
    await expect(textarea).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("input-keyboard.png") });
    await input.tap();
    await expect(accessory).toHaveCount(0);
    await expect(textarea).not.toBeFocused();
    await input.tap();
    await expect(accessory.getByRole("button", { name: "Tab", exact: true })).toBeVisible();
    await expect(accessory.getByRole("button", { name: "Ctrl", exact: true })).toHaveAttribute("data-mode", "off");
    await expect(textarea).not.toBeFocused();
    await expect.poll(() => sent).toEqual(["ctrl+Tab", "Escape"]);
  });
}

for (const [locale, width] of [["zh", 320], ["en", 320]] as const) {
  test(`Type arms over a draft and gives it back: ${locale} ${width}`, async ({ page }, testInfo) => {
    const messages = dictionaries[locale];
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((code) => localStorage.setItem("collie:locale:v1", code), locale);
    await installApiStub(page);
    const sent: string[] = [];
    await page.route("**/api/pane/*/keys*", async (route) => {
      sent.push(...route.request().postDataJSON().keys);
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/pane/w1:p1");
    const textarea = page.getByRole("textbox");
    await textarea.fill("half a reply");
    const controls = page.getByRole("group", { name: messages["composer.controls.label"] });
    await controls.getByRole("button", { name: messages["composer.controls.typeAria"] }).tap();
    await expect(textarea).toHaveValue("");
    const kept = page.getByText(messages["sendMode.armed.draftKept"]);
    await expect.poll(() => kept.evaluate((el) =>
      getComputedStyle(el.closest('[data-slot="collapse"]')!).overflowY,
    )).toBe("visible");
    await expect(kept).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("draft-kept.png") });
    await page.getByRole("button", { name: messages["sendMode.armed.stop"], exact: true }).tap();
    await expect(textarea).toHaveValue("half a reply");
    expect(sent).toEqual([]);
  });
}
