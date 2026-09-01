export type PushLocale = "en" | "de" | "es" | "ko" | "ja" | "zh";

export type PushCopy =
  | {
      kind: "agent";
      agent: string;
      status: "blocked" | "done";
      workspaceLabel: string;
      cwd: string;
      host?: string;
    }
  | {
      kind: "agents";
      count: number;
      status: "blocked" | "done" | "mixed";
      agents: string[];
      host?: string;
    }
  | { kind: "update"; version: string };

export interface LocalizedPushCopy {
  title: string;
  body: string;
}

export function parsePushLocale(value: JsonValue | undefined): PushLocale | undefined {
  switch (value) {
    case "en":
    case "de":
    case "es":
    case "ko":
    case "ja":
    case "zh":
      return value;
    default:
      return undefined;
  }
}

export function pushLocale(value: JsonValue | undefined): PushLocale {
  return parsePushLocale(value) ?? "en";
}

function updateCopy(version: string, locale: PushLocale): LocalizedPushCopy {
  switch (locale) {
    case "de":
      return { title: "Collie-Update verfügbar", body: `Version ${version} ist verfügbar` };
    case "es":
      return {
        title: "Actualización de Collie disponible",
        body: `La versión ${version} está disponible`,
      };
    case "ko":
      return { title: "Collie 업데이트 사용 가능", body: `버전 ${version}을 사용할 수 있습니다` };
    case "ja":
      return { title: "Collie のアップデートがあります", body: `バージョン ${version} を利用できます` };
    case "zh":
      return { title: "Collie 有可用更新", body: `可更新至版本 ${version}` };
    default:
      return { title: "Collie update available", body: `Version ${version} is available` };
  }
}

function agentTitle(copy: Extract<PushCopy, { kind: "agent" }>, locale: PushLocale): string {
  const done = copy.status === "done";
  switch (locale) {
    case "de":
      return `${copy.agent} ${done ? "ist fertig" : "braucht dich"}`;
    case "es":
      return `${copy.agent} ${done ? "ha terminado" : "te necesita"}`;
    case "ko":
      return `${copy.agent} ${done ? "작업이 완료되었습니다" : "에서 확인이 필요합니다"}`;
    case "ja":
      return `${copy.agent} ${done ? "が完了しました" : "で確認が必要です"}`;
    case "zh":
      return `${copy.agent} ${done ? "已完成" : "需要你处理"}`;
    default:
      return `${copy.agent} ${done ? "is done" : "needs you"}`;
  }
}

function agentsTitle(copy: Extract<PushCopy, { kind: "agents" }>, locale: PushLocale): string {
  const { count, status } = copy;
  switch (locale) {
    case "de":
      return status === "blocked"
        ? `${count} Agents brauchen dich`
        : status === "done"
          ? `${count} Agents sind fertig`
          : `${count} Agents benötigen Aufmerksamkeit`;
    case "es":
      return status === "blocked"
        ? `${count} agentes te necesitan`
        : status === "done"
          ? `${count} agentes han terminado`
          : `${count} agentes requieren atención`;
    case "ko":
      return status === "blocked"
        ? `${count}개 Agent에서 확인이 필요합니다`
        : status === "done"
          ? `${count}개 Agent 작업이 완료되었습니다`
          : `${count}개 Agent에 주의가 필요합니다`;
    case "ja":
      return status === "blocked"
        ? `${count} 件の Agent で確認が必要です`
        : status === "done"
          ? `${count} 件の Agent が完了しました`
          : `${count} 件の Agent に対応が必要です`;
    case "zh":
      return status === "blocked"
        ? `${count} 个 Agent 需要你处理`
        : status === "done"
          ? `${count} 个 Agent 已完成`
          : `${count} 个 Agent 需要查看`;
    default:
      return status === "blocked"
        ? `${count} agents need you`
        : status === "done"
          ? `${count} agents done`
          : `${count} agents need attention`;
  }
}

export function localizePushCopy(copy: PushCopy, locale: PushLocale): LocalizedPushCopy {
  if (copy.kind === "update") return updateCopy(copy.version, locale);
  if (copy.kind === "agent") {
    return {
      title: agentTitle(copy, locale),
      body: [copy.host, copy.workspaceLabel, copy.cwd].filter(Boolean).join(" · "),
    };
  }
  const agents = copy.agents.join(", ");
  return { title: agentsTitle(copy, locale), body: copy.host ? `${copy.host} · ${agents}` : agents };
}
import type { JsonValue } from "./json.ts";
