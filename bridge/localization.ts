export type PushLocale = "en" | "zh-CN" | "zh-TW";

export type PushCopy =
  | {
      kind: "agent";
      agent: string;
      status: "blocked" | "done";
      workspaceLabel: string;
      cwd: string;
    }
  | {
      kind: "agents";
      count: number;
      status: "blocked" | "done" | "mixed";
      agents: string[];
    }
  | { kind: "update"; version: string };

export interface LocalizedPushCopy {
  title: string;
  body: string;
}

/** Accept a persisted/client locale while keeping old and malformed rows on the English fallback. */
export function pushLocale(value: unknown): PushLocale {
  return value === "zh-CN" || value === "zh-TW" ? value : "en";
}

/** Render structured notification copy for one subscription's concrete locale. */
export function localizePushCopy(copy: PushCopy, locale: PushLocale): LocalizedPushCopy {
  if (copy.kind === "update") {
    if (locale === "zh-CN") {
      return { title: "Collie 有可用更新", body: `可更新至版本 ${copy.version}` };
    }
    if (locale === "zh-TW") {
      return { title: "Collie 有可用更新", body: `可更新至版本 ${copy.version}` };
    }
    return { title: "Collie update available", body: `Version ${copy.version} is available` };
  }

  if (copy.kind === "agent") {
    const body = `${copy.workspaceLabel} · ${copy.cwd}`;
    if (locale === "zh-CN") {
      return {
        title: `${copy.agent} ${copy.status === "blocked" ? "需要你处理" : "已完成"}`,
        body,
      };
    }
    if (locale === "zh-TW") {
      return {
        title: `${copy.agent} ${copy.status === "blocked" ? "需要你處理" : "已完成"}`,
        body,
      };
    }
    return {
      title: `${copy.agent} ${copy.status === "blocked" ? "needs you" : "is done"}`,
      body,
    };
  }

  const body = copy.agents.join(", ");
  if (locale === "zh-CN") {
    const suffix =
      copy.status === "blocked" ? "需要你处理" : copy.status === "done" ? "已完成" : "需要查看";
    return { title: `${copy.count} 个 Agent ${suffix}`, body };
  }
  if (locale === "zh-TW") {
    const suffix =
      copy.status === "blocked" ? "需要你處理" : copy.status === "done" ? "已完成" : "需要查看";
    return { title: `${copy.count} 個 Agent ${suffix}`, body };
  }
  const suffix =
    copy.status === "blocked" ? "need you" : copy.status === "done" ? "done" : "need attention";
  return { title: `${copy.count} agents ${suffix}`, body };
}
