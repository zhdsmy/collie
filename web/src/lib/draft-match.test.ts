import { draftCarriesSend } from "./draft-match";

it.each([
  ["ship it please", "ship it please"],
  ["first paragraph\n\nlast paragraph", "first paragraph last paragraph"],
  ["请检查这个输入问题然后继续", "请检查这个输入 问题然后继续"],
  ["これは pull request のテストです", "これは pull request のテ ストです"],
  ["see 👨‍👩‍👧‍👦 and café", "see 👨‍👩‍👧‍👦 and café"],
  ["  ship it please\n", "ship it please"],
])("accepts complete text with terminal wrapping: %j", (sent, draft) => {
  expect(draftCarriesSend(sent, draft, { requireTail: true })).toBe(true);
});

it.each([
  ["first paragraph and last paragraph", "last paragraph"],
  ["first paragraph and last paragraph", "paragraph"],
  ["请先检查然后处理这个输入问题", "然后处理这个 输入问题"],
  ["repeat repeat repeat", "repeat repeat"],
  ["ab cdefgh and ab cdefgh", "ab cdefgh"],
  ["请检查".repeat(300) + " 最后继续处理", "请检查请检查 最后继续处理"],
])("accepts a visible tail when a long draft scrolls: %j", (sent, draft) => {
  expect(draftCarriesSend(sent, draft, { requireTail: true })).toBe(true);
});

it.each([
  ["请检查这个输入问题然后继续", "请检查这个输入问题"],
  ["first paragraph and last paragraph", "paragraph and last"],
  ["repeat repeat repeat then finish", "repeat repeat"],
  ["deploy the app now", "deploy  the app now"],
  ["delete file now", "delete　file now"],
  ["deploy the app now", "deploythe app now"],
  ["ab cdefgh and a bcdefgh", "ab cdefgh"],
  ["first paragraph and last paragraph", "last"],
  ["see 👨‍👩‍👧‍👦", "see 👩‍👧‍👦"],
  ["long enough 👨‍👩‍👧‍👦 more text", "👩‍👧‍👦 more text"],
  ["ship it please", null],
])("refuses incomplete or changed text: %j", (sent, draft) => {
  expect(draftCarriesSend(sent, draft, { requireTail: true })).toBe(false);
});

it("retains the generic windowed match for other harnesses", () => {
  const sent = "请检查这个输入问题然后继续";
  expect(draftCarriesSend(sent, "请检查这个输入问题")).toBe(true);
  expect(draftCarriesSend(sent, "请检查这个输入问题", { requireTail: true })).toBe(false);
});
