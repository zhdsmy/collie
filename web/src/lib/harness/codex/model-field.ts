import type { CodexReasoningEffort } from "../../codex-model-presets";

export interface CodexModelField {
  model: string;
  effort: CodexReasoningEffort | null;
}

const EFFORTS: ReadonlyMap<string, CodexReasoningEffort> = new Map([
  ["none", "none"],
  ["minimal", "minimal"],
  ["low", "low"],
  ["medium", "medium"],
  ["high", "high"],
  ["xhigh", "xhigh"],
  ["extra high", "xhigh"],
  ["max", "max"],
  ["ultra", "ultra"],
]);

const MODEL_SUFFIX = /\s+\((?:default|current)\)$/i;
const PLAN_SUFFIX = /^plan mode(?:\s|$)/i;
const GPT_MODEL = /^gpt-[a-z0-9][a-z0-9._:/-]*$/i;

function cleanField(text: string): string {
  return text.trim().replace(MODEL_SUFFIX, "").trim();
}

function effortSuffix(text: string): CodexReasoningEffort | null | undefined {
  const suffix = text.trim();
  if (suffix === "") return null;
  const direct = EFFORTS.get(suffix.toLowerCase());
  if (direct !== undefined) return direct;
  // Older Codex statuslines append the Plan-mode hint directly to the model field.
  if (PLAN_SUFFIX.test(suffix)) return null;
  const withPlan = /^(none|minimal|low|medium|high|xhigh|max|ultra|extra high)\s+plan mode(?:\s|$)/i.exec(suffix);
  if (!withPlan) return undefined;
  return EFFORTS.get(withPlan[1]!.toLowerCase());
}

/**
 * Parse one complete Codex statusline field. A known model list may contain custom IDs; without it
 * only the CLI's unambiguous `gpt-*` model shape is accepted, so cwd/branch fields stay untouched.
 */
export function parseCodexModelField(
  text: string,
  knownModels: readonly string[] = [],
): CodexModelField | null {
  const field = cleanField(text);
  if (!field) return null;

  const known = [...new Set(knownModels)]
    .filter((model) => model.trim() !== "" && !/\s/.test(model))
    .toSorted((a, b) => b.length - a.length);
  for (const model of known) {
    if (field === model) return { model, effort: null };
    if (!field.startsWith(`${model} `)) continue;
    const effort = effortSuffix(field.slice(model.length));
    if (effort !== undefined) return { model, effort };
  }

  const match = /^gpt-[^\s]+/i.exec(field);
  if (!match || !GPT_MODEL.test(match[0]!)) return null;
  const model = match[0]!;
  const effort = effortSuffix(field.slice(model.length));
  return effort === undefined ? null : { model, effort };
}
