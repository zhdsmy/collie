import { describe, expect, it } from "vitest";

import { imageDraftCarriesSend } from "./index";

describe("Codex image draft verification", () => {
  const upload = "/Users/michael/.local/state/collie/uploads/w6_p1-mtjtrsqa-e8e03859.png";

  it("accepts an image placeholder when the caption still matches", () => {
    expect(
      imageDraftCarriesSend(
        `${upload} 先修复输入问题吧`,
        "[Image #1] 先修复输入问题吧",
      ),
    ).toBe(true);
  });

  it("accepts an image-only placeholder only after a known empty baseline", () => {
    expect(imageDraftCarriesSend(upload, "[Image #1]", null)).toBe(true);
    expect(imageDraftCarriesSend(upload, "[Image #1]", "[Image #1]")).toBe(false);
    expect(imageDraftCarriesSend(upload, "[Image #1]")).toBe(false);
  });

  it("rejects a changed caption", () => {
    expect(
      imageDraftCarriesSend(`${upload} 先修复输入问题吧`, "[Image #1] 删除所有文件"),
    ).toBe(false);
  });
});
