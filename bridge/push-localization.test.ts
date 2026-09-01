import { describe, expect, test } from "bun:test";

import { localizePushCopy, parsePushLocale, pushLocale } from "./push-localization.ts";

describe("push notification localization", () => {
  test("accepts Collie's six locales and falls back legacy rows to English", () => {
    for (const locale of ["en", "de", "es", "ko", "ja", "zh"] as const) {
      expect(parsePushLocale(locale)).toBe(locale);
    }
    expect(parsePushLocale("fr")).toBeUndefined();
    expect(pushLocale(undefined)).toBe("en");
  });

  test("renders agent, digest and update copy for every locale", () => {
    const agent = {
      kind: "agent" as const,
      agent: "codex",
      status: "done" as const,
      workspaceLabel: "collie",
      cwd: "/home/you/collie",
    };
    const digest = {
      kind: "agents" as const,
      count: 2,
      status: "mixed" as const,
      agents: ["claude", "codex"],
    };

    expect(localizePushCopy(agent, "en").title).toBe("codex is done");
    expect(localizePushCopy(agent, "de").title).toBe("codex ist fertig");
    expect(localizePushCopy(agent, "es").title).toBe("codex ha terminado");
    expect(localizePushCopy(agent, "ko").title).toContain("완료");
    expect(localizePushCopy(agent, "ja").title).toContain("完了");
    expect(localizePushCopy(agent, "zh").title).toBe("codex 已完成");
    expect(localizePushCopy(digest, "zh")).toEqual({
      title: "2 个 Agent 需要查看",
      body: "claude, codex",
    });
    expect(localizePushCopy({ kind: "update", version: "1.0.1" }, "ja").body).toContain(
      "1.0.1",
    );
  });

  test("keeps a pack host in the localized body", () => {
    expect(
      localizePushCopy(
        {
          kind: "agents",
          count: 2,
          status: "blocked",
          agents: ["claude", "codex"],
          host: "studio",
        },
        "zh",
      ).body,
    ).toBe("studio · claude, codex");
  });
});
