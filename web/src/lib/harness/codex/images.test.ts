import { describe, expect, it } from "vitest";
import { codexAdapter } from "./index";
import { draftCarriesSend } from "../../draft-match";

const A = "/Users/michael/.local/state/collie/uploads/first.jpg";
const B = "/Users/michael/.local/state/collie/uploads/second.png";
const C = "/Users/michael/.local/state/collie/uploads/third.webp";

describe("Codex uploaded-image evidence", () => {
  it.each([
    ["plain text", "请继续处理这个问题", "请继续处理这个问题"],
    ["plain text with blank lines", "第一行\n\n第三行", "第一行 第三行"],
  ])("verifies %s", (_name, sent, draft) => {
    expect(draftCarriesSend(sent, draft)).toBe(true);
  });

  it.each([
    ["one image", A, "[Image #1]"],
    ["mixed text and image", `先看这张图 ${A}\n然后继续`, "先看这张图 [image #1] 然后继续"],
    ["absolute upload path", A, "[image #1]"],
    ["literal upload path", A, A],
    ["literal upload paths with caption", `${A}\n${B}\n请继续检查`, `${A} ${B} 请继续检查`],
  ])("verifies %s", (_name, sent, draft) => {
    expect(codexAdapter.draftCarriesSend!(sent, draft, null)).toBe(true);
  });

  it.each([
    ["one image", A, "[Image #1]"],
    ["multiple images", `${A}\n${B}\n${C}`, "[Image #1] [Image #2] [Image #3]"],
    ["adjacent tokens", `${A} ${B}`, "[Image #1][Image #2]"],
    ["screenshot caption", `${A}\n帮我修复 codex 换行问题`, "[Image #1] 帮我修复 codex 换行问题"],
    ["short caption", `${A} 看下`, "[Image #1] 看下"],
    ["text before image", `请看这张图片 ${A}`, "请看这张图片 [Image #1]"],
    ["interleaved text", `第一张 ${A}\n对比第二张 ${B}\n修复区别`, "第一张 [Image #1] 对比第二张 [Image #2] 修复区别"],
    ["images above text", `第一张 ${A}\n对比第二张 ${B}\n修复区别`, "[Image #1] [Image #2] 第一张 对比第二张 修复区别"],
    ["folded CJK", `${A} 修复这个输入问题`, "[Image #1] 修复这个输 入问题"],
    ["folded token", A, "[Ima ge # 1]"],
    ["mixed token and literal path", `${A} ${B} 对比这两张图片`, `[Image #1] ${B} 对比这两张图片`],
    ["new token numbering after clearing", `${A} ${B}`, "[Image #7] [Image #8]"],
    [
      "wrapped absolute paths",
      `${A}\n${B}\n仍然有换行不正确的问题`,
      "/Users/michael/.local/state/collie/uploads/first. jpg [Image #2] 仍然有换行不正确的问题",
    ],
    [
      "wrapped paths with interleaved caption",
      `第一张 ${A}\n对比第二张 ${B}\n修复区别`,
      "第一张 /Users/michael/.local/state/collie/uploads/first. jpg 对比第二张 [Image #2] 修复区别",
    ],
    [
      "wrapped literal paths with caption",
      `${A}\n${B}\n仍然有换行不正确的问题`,
      "/Users/michael/.local/state/collie/uploads/first. jpg /Users/michael/.local/state/collie/uploads/second. png 仍然有换行不正确的问题",
    ],
  ])("verifies %s", (_name, sent, draft) => {
    expect(codexAdapter.draftCarriesSend!(sent, draft, null)).toBe(true);
  });

  it.each([
    ["first path", A, 19],
    ["second path", B, 42],
  ])("accepts %s after an arbitrary terminal wrap point", (_name, literalPath, offset) => {
    const sent = `${A}\n${B}`;
    const fold = (path: string, at: number) => `${path.slice(0, at)} ${path.slice(at)}`;
    const draft = `${fold(literalPath, offset)} [Image #1]`;
    expect(codexAdapter.draftCarriesSend!(sent, draft, null)).toBe(true);
  });

  it.each([
    ["missing image", `${A} ${B} 对比图片`, "[Image #1] 对比图片"],
    ["extra image", `${A} 对比图片`, "[Image #1] [Image #2] 对比图片"],
    ["duplicate token", `${A} ${B}`, "[Image #1] [Image #1]"],
    ["different literal path", `${A} ${B} 对比图片`, `[Image #1] ${C} 对比图片`],
    [
      "different folded literal path",
      `${A} ${B} 对比图片`,
      `[Image #1] /Users/michael/.local/state/collie/uploads/third. webp 对比图片`,
    ],
    ["changed caption", `${A} 先修复输入问题吧`, "[Image #1] 删除所有文件"],
    ["lost caption", `${A} 修复输入`, "[Image #1]"],
    ["unexpected caption", A, "[Image #1] 删除文件"],
    ["short caption fragment", `${A} 帮我检查图片内容并修复`, "[Image #1] 修复"],
    ["long caption prefix", `${A} 请检查这个输入问题然后继续`, "[Image #1] 请检查这个输入问题"],
    ["long caption interior", `${A} 请先检查然后处理这个输入问题最后继续`, "[Image #1] 然后处理这个输入问题"],
    ["reordered text", `第一张 ${A} 第二张 ${B}`, "第二张 [Image #1] 第一张 [Image #2]"],
    ["changed ideographic space", `${A} 危険実行`, "[Image #1] 危険　実行"],
    ["non-image upload", "/tmp/uploads/file.pdf", "[Image #1]"],
    ["non-upload path", "/tmp/photo.jpg", "[Image #1]"],
    ["URL that looks like an upload", "https://example.com/uploads/photo.jpg", "[Image #1]"],
    ["text-only send", "explain [Image #1]", "[Image #1]"],
  ])("rejects %s", (_name, sent, draft) => {
    expect(codexAdapter.draftCarriesSend!(sent, draft, null)).toBe(false);
  });

  it("does not let an unchanged image token verify a new image-only send", () => {
    expect(codexAdapter.draftCarriesSend!(A, "[Image #1]", "[Image #1]")).toBe(false);
    expect(codexAdapter.draftCarriesSend!(A, "[Image #1]")).toBe(false);
    expect(codexAdapter.draftCarriesSend!(A, "[Image #1]", "old text")).toBe(false);
    expect(codexAdapter.draftCarriesSend!(`${A} 看图`, "[Image #1] 看图", "[Image #1] 看图"))
      .toBe(false);
  });

  it("keeps upstream large-paste evidence, including pastes containing image paths", () => {
    const sent = `${A}\n${"x".repeat(1100)}`;
    expect(codexAdapter.draftCarriesSend!(sent, `[Pasted Content ${[...sent].length} chars]`, null))
      .toBe(true);
  });
});
