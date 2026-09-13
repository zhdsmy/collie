/**
 * The reasoning levels Codex 0.154 actually offers, and no others: its "Select Reasoning Level"
 * picker lists Low / Medium / High / Extra high plus a "More reasoning…" step holding Max and Ultra
 * (`codex--v0154-picker-effort.txt`). There is no `none` and no `minimal` row to choose, so a switch
 * asking for one could only ever come back `unsupported-effort`.
 *
 * This module is the vocabulary's home because it is the one that reads the statusline back — the
 * spelling here and the spelling the terminal prints are the same fact, so they live together.
 */
export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

/** The runtime spelling of {@link CodexReasoningEffort}, for validating what came off disk. */
export const CODEX_REASONING_EFFORTS = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const satisfies readonly CodexReasoningEffort[];

/** A model + reasoning level a switch can be asked for, and the identity of a history row. */
export interface CodexModelTarget {
  model: string;
  effort: CodexReasoningEffort;
}

export interface CodexModelField {
  model: string;
  effort: CodexReasoningEffort | null;
}

/** The statusline spelling of every level a switch can name; "Extra high" is `xhigh` in the field. */
const EFFORTS: ReadonlyMap<string, CodexReasoningEffort> = new Map([
  ["low", "low"],
  ["medium", "medium"],
  ["high", "high"],
  ["xhigh", "xhigh"],
  ["extra high", "xhigh"],
  ["max", "max"],
  ["ultra", "ultra"],
]);

/**
 * A codex level no switch may name: `minimal` is in the CLI's config enum, but the picker Collie
 * drives never offers it (`codex--v0154-picker-effort.txt`). Set outside Collie it can still reach a
 * statusline, and that line must still parse AS the model — it just names no effort here.
 */
const UNNAMEABLE_EFFORTS: ReadonlySet<string> = new Set(["minimal"]);

const MODEL_SUFFIX = /\s+\((?:default|current)\)$/i;
const PLAN_SUFFIX = /^plan mode(?:\s|$)/i;
const GPT_MODEL = /^gpt-[a-z0-9][a-z0-9._:/-]*$/i;

/**
 * One statusline field, with the level Codex prints BESIDE it rather than inside it.
 *
 * Codex 0.154 splits the two: the row reads `gpt-5.6-sol · high`, so the field that carries the model
 * carries no level at all and `parseCodexModelField` alone reports `effort: null`. Older statuslines
 * (and the "Model changed to …" line) keep them together. Passing the neighbour covers both without
 * guessing: the join only succeeds when the neighbour really is a level, because
 * `parseCodexModelField("gpt-5.6-sol Working")` is not a model field at all.
 */
export function parseCodexStatuslineField(
  text: string,
  next: string | undefined,
  knownModels: readonly string[] = [],
): CodexModelField | null {
  const direct = parseCodexModelField(text, knownModels);
  if (direct === null || direct.effort !== null || next === undefined) return direct;
  return parseCodexModelField(`${text} ${next}`, knownModels) ?? direct;
}

function cleanField(text: string): string {
  return text.trim().replace(MODEL_SUFFIX, "").trim();
}

function effortSuffix(text: string): CodexReasoningEffort | null | undefined {
  const suffix = text.trim();
  if (suffix === "") return null;
  const direct = EFFORTS.get(suffix.toLowerCase());
  if (direct !== undefined) return direct;
  if (UNNAMEABLE_EFFORTS.has(suffix.toLowerCase())) return null;
  // Older Codex statuslines append the Plan-mode hint directly to the model field.
  if (PLAN_SUFFIX.test(suffix)) return null;
  const withPlan = /^(minimal|low|medium|high|xhigh|max|ultra|extra high)\s+plan mode(?:\s|$)/i.exec(suffix);
  if (!withPlan) return undefined;
  // The regex only matches real codex levels, so a miss here is the unnameable case, never garbage.
  return EFFORTS.get(withPlan[1]!.toLowerCase()) ?? null;
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
