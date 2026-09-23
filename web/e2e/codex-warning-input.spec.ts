import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { fixtureSnapshot } from "@/test/handlers";
import { installApiStub } from "./fixtures/api";

test.use({ serviceWorkers: "block" });

const empty = readFileSync(new URL("../src/fixtures/panes/codex--v0154-particles-working.txt", import.meta.url), "utf8")
  .replace(/\n$/, `${" ".repeat(32)}⚠ 1 warning · f2 to view\n`);
const paint = "\u001b[0m\u001b[48;2;57;57;71m";
const uploadPaths = ["/test-state/uploads/one.png", "/test-state/uploads/two.png", "/test-state/uploads/three.png", "/test-state/uploads/four.png"];
const longText = `BEGIN ${"请检查这个输入问题".repeat(120)} END`;
const cases = [
  { name: "image only", uploads: 1, draft: "[Image #1] ", sent: uploadPaths[0]!, shown: "[Image #1]" },
  {
    name: "interleaved text and images", uploads: 2,
    draft: "第一张 [Image #1]\n第二张 [Image #2]\n请比较",
    sent: `第一张 ${uploadPaths[1]}\n第二张 ${uploadPaths[2]}\n请比较`,
    shown: "第一张 [Image #1]\n第二张 [Image #2]\n请比较",
  },
  {
    name: "absolute path and image marker", uploads: 1,
    draft: "查看 /private/tmp/existing.png 和 [Image #1]",
    sent: `查看 /private/tmp/existing.png 和 ${uploadPaths[3]}`,
    shown: "查看 /private/tmp/existing.png 和 [Image #1]",
  },
  { name: "long text", uploads: 0, draft: longText, sent: longText, shown: `[Pasted Content ${[...longText].length} chars]` },
];

function typedFrame(draft: string): string {
  return empty.replace(
    "\u001b[2m\u001b[48;2;57;57;71mAsk Codex to do anything",
    draft.split("\n").map((line) => paint + line).join(`\n${paint}  `),
  );
}

test("Codex warning return keeps image, mixed, and long replies sendable", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("collie:locale:v1", "en");
    localStorage.setItem("collie:theme:v1", "dark");
  });
  await installApiStub(page);
  let screen: "ready" | "warning" | "draft" = "ready";
  let caseIndex = 0;
  let uploads = 0;
  const keys: string[][] = [];
  const replies: Array<{ text: string; submit: boolean; expected_prompt?: string }> = [];

  await page.route("**/api/snapshot*", (route) => route.fulfill({ json: {
    ...fixtureSnapshot,
    agents: fixtureSnapshot.agents.map((agent, index) => index === 0
      ? Object.assign({}, agent, { agent: "codex", status: "working", hasSession: true }) : agent),
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route) => route.fulfill({ json: {
    paneId: "w1:p1",
    text: screen === "warning"
      ? "Warnings · 1 of 1 · MCP · qa\n\nMCP startup incomplete\n\nesc back · ctrl+o copy · ←/→ warning · ↓ scroll"
      : screen === "draft" ? typedFrame(cases[caseIndex]!.shown) : empty,
    revision: 1,
    truncated: false,
  } }));
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/keys", (route) => {
    // SAFETY: this route receives the app's own sendKeys request body.
    const body = route.request().postDataJSON() as { keys: string[]; expected_prompt?: string };
    keys.push(body.keys);
    if (body.keys[0] === "f2") {
      expect(body.expected_prompt).toContain("› Ask Codex to do anything");
      screen = "warning";
    } else if (body.keys[0] === "Escape") screen = "ready";
    return route.fulfill({ json: { ok: true } });
  });
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/upload", (route) => {
    return route.fulfill({ json: { ok: true, path: uploadPaths[uploads++] } });
  });
  await page.route((url) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1/reply", (route) => {
    // SAFETY: this route receives the app's own sendReply request body.
    const body = route.request().postDataJSON() as typeof replies[number];
    replies.push(body);
    if (body.submit) {
      expect(body.expected_prompt).toContain(cases[caseIndex]!.shown.split("\n").at(-1)!);
      screen = "ready";
      caseIndex++;
    } else screen = "draft";
    return route.fulfill({ json: { ok: true } });
  });

  await page.goto("/pane/w1:p1");
  await page.getByRole("button", { name: "⚠ 1 warning · f2 to view" }).click();
  await expect(page.getByText(/Warnings · 1 of 1/)).toBeVisible();
  const type = page.getByRole("button", { name: "Type into terminal" });
  await type.click();
  await page.getByTestId("direct-keyboard-accessory").getByRole("button", { name: "Escape" }).click();
  await expect(page.getByText(/Warnings · 1 of 1/)).toHaveCount(0);
  await type.click();
  expect(keys).toEqual([["f2"], ["Escape"]]);

  const input = page.getByRole("textbox").first();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=", "base64");
  for (const [index, sample] of cases.entries()) {
    await test.step(sample.name, async () => {
      if (sample.uploads > 0) {
        await page.getByTestId("attach-photos").setInputFiles(Array.from({ length: sample.uploads }, (_, photoIndex) => ({
          name: `photo-${photoIndex + 1}.png`, mimeType: "image/png", buffer: png,
        })));
        await expect(input).toHaveValue(new RegExp(`\\[Image #${sample.uploads}\\]`));
      }
      await input.fill(sample.draft);
      await expect(input).toBeEnabled();
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeInViewport();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect.poll(() => replies.length).toBe(2 * (index + 1));
      expect(caseIndex).toBe(index + 1);
      await expect(input).toHaveValue("");
      expect(replies.slice(-2)).toEqual([
        { text: sample.sent, submit: false },
        { text: "", submit: true, expected_prompt: expect.stringContaining(sample.shown.split("\n").at(-1)!) },
      ]);
    });
  }
  expect(caseIndex).toBe(cases.length);
  expect(uploads).toBe(4);
  expect(keys).toEqual([["f2"], ["Escape"]]);
});
