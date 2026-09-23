import { fetchPane, fetchSnapshot } from "./api";
import { describeThrownError } from "./api-error-message";
import { parseAnsi } from "./ansi";
import { lineText, splitLines } from "./blocks";
import { sendBoundKeys } from "./dialog-guard";
import { codexAdapter } from "./harness/codex";
import { composerPrompt, locateComposer } from "./harness/codex/chrome";
import { blockOwnsKeyboard } from "./harness/dialog-contract";
import { acquirePaneAction, releasePaneAction } from "./picker-action";
import type { Scope } from "./scope";

export function codexWarningCount(text: string): number | null {
  const fields = text.trim().split(/\s*·\s*| {2,}(?=⚠ [1-9]\d* warnings?\b)/);
  for (let i = 0; i + 1 < fields.length; i++) {
    const warning = /^⚠ ([1-9]\d*) warnings?$/.exec(fields[i]!.trim());
    if (warning && fields[i + 1]!.trim() === "f2 to view") return Number(warning[1]);
  }
  return null;
}

export async function openCodexWarnings(args: {
  paneId: string;
  scope?: Scope;
  requestedLines: number;
  codexSessionKey?: string;
  count: number;
}): Promise<{ status: "sent" | "blocked" | "changed" | "error"; error?: string }> {
  const owner = acquirePaneAction(args.paneId, args.scope);
  if (!owner) return { status: "blocked" };
  try {
    const snapshot = await fetchSnapshot(args.scope);
    const agent = snapshot.agents.find((candidate) => candidate.paneId === args.paneId);
    if (snapshot.bridge !== "connected" || agent?.agent !== "codex" ||
        !["idle", "working", "done"].includes(agent.status)) return { status: "blocked" };

    const fresh = await fetchPane(args.paneId, args.requestedLines, args.scope);
    if (fresh.codexSessionKey !== args.codexSessionKey) return { status: "changed" };
    const lines = splitLines(parseAnsi(fresh.text));
    if (locateComposer(lines) === null || codexAdapter.buildBlocks(lines).some(blockOwnsKeyboard) ||
        codexAdapter.extractInputDraft(lines) !== null ||
        !codexAdapter.extractStatusLines(lines).some((row) => codexWarningCount(lineText(row)) === args.count)) {
      return { status: "changed" };
    }
    const prompt = composerPrompt(lines);
    if (prompt === null) return { status: "blocked" };
    return sendBoundKeys(args, ["f2"], prompt);
  } catch (error) {
    return { status: "error", error: describeThrownError(error) };
  } finally {
    releasePaneAction(owner);
  }
}
