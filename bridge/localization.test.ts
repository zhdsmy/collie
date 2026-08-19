import { describe, expect, test } from "bun:test";

import { localizePushCopy, pushLocale } from "./localization.ts";

describe("push localization", () => {
  test("normalizes missing and unsupported persisted locales to English", () => {
    expect(pushLocale(undefined)).toBe("en");
    expect(pushLocale("fr")).toBe("en");
    expect(pushLocale("zh-CN")).toBe("zh-CN");
    expect(pushLocale("zh-TW")).toBe("zh-TW");
  });

  test("localizes single-agent, digest, and update copy in all supported languages", () => {
    const single = {
      kind: "agent" as const,
      agent: "codex",
      status: "done" as const,
      workspaceLabel: "collie",
      cwd: "/home/you/collie",
    };
    expect(localizePushCopy(single, "en").title).toBe("codex is done");
    expect(localizePushCopy(single, "zh-CN").title).toBe("codex 已完成");
    expect(localizePushCopy(single, "zh-TW").title).toBe("codex 已完成");

    const digest = {
      kind: "agents" as const,
      count: 2,
      status: "mixed" as const,
      agents: ["claude", "codex"],
    };
    expect(localizePushCopy(digest, "en")).toEqual({
      title: "2 agents need attention",
      body: "claude, codex",
    });
    expect(localizePushCopy(digest, "zh-CN").title).toBe("2 个 Agent 需要查看");
    expect(localizePushCopy(digest, "zh-TW").title).toBe("2 個 Agent 需要查看");

    const update = { kind: "update" as const, version: "0.32.0" };
    expect(localizePushCopy(update, "en").body).toBe("Version 0.32.0 is available");
    expect(localizePushCopy(update, "zh-CN").body).toBe("可更新至版本 0.32.0");
    expect(localizePushCopy(update, "zh-TW").body).toBe("可更新至版本 0.32.0");
  });
});
