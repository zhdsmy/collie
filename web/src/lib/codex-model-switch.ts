import { fetchPane, fetchSnapshot } from "./api";
import { describeThrownError } from "./api-error-message";
import { parseAnsi } from "./ansi";
import { blockOwnsKeyboard } from "./harness/dialog-contract";
import { codexAdapter } from "./harness/codex";
import { defaultSleep, POLL_ATTEMPTS, POLL_DELAY_MS, type ActionResult, type Sleep } from "./harness/guard";
import { splitLines, lineText } from "./blocks";
import { parseCodexModelField } from "./harness/codex/model-field";
import {
  acquirePaneAction,
  releasePaneAction,
  submitPickerIntent,
  type PaneActionOwner,
} from "./picker-action";
import { sendGuardedReply, type ReplyOutcome } from "./reply-action";
import type { CodexModelPreset, CodexReasoningEffort } from "./codex-model-presets";
import type { PickerModel } from "./harness/picker-model";
import type { Scope } from "./scope";

export type CodexModelSwitchStatus =
  | "switched"
  | "opened"
  | "cancelled"
  | "blocked"
  | "unsupported-model"
  | "unsupported-effort"
  | "changed"
  | "unconfirmed"
  | "error";

export interface CodexModelSwitchArgs {
  paneId: string;
  scope?: Scope;
  requestedLines: number;
  preset?: CodexModelPreset;
  signal: AbortSignal;
  /** Test seam for bounded native TUI polling. */
  sleep?: Sleep;
}

export interface CodexModelSwitchResult {
  status: CodexModelSwitchStatus;
  error?: string;
}

interface PickerRead {
  model: PickerModel;
  revision: number;
  text: string;
}

interface FreshPane {
  text: string;
  revision: number;
  lines: ReturnType<typeof splitLines>;
}

const MODEL_TITLE = /^Select Model(?: and Effort)?$/;
const EFFORT_TITLE = /^Select Reasoning Level for (.+)$/;
const ADVANCED_TITLE = "Advanced Reasoning";
const SCOPE_TITLE = "Apply reasoning change";
const MAX_MODEL_BROWSE_STEPS = 128;

function result(status: CodexModelSwitchStatus, error?: string): CodexModelSwitchResult {
  return error === undefined ? { status } : { status, error };
}

function isCancelled(signal: AbortSignal): boolean {
  return signal.aborted;
}

function isModelPicker(model: PickerModel): boolean {
  return model.kind === "single" && model.questionnaire === undefined && MODEL_TITLE.test(model.title);
}

function isEffortPicker(model: PickerModel): boolean {
  return model.kind === "single" && model.questionnaire === undefined && EFFORT_TITLE.test(model.title);
}

function isEffortPickerFor(model: PickerModel, requestedModel: string): boolean {
  const match = EFFORT_TITLE.exec(model.title);
  return isEffortPicker(model) && match?.[1] === requestedModel;
}

function isAdvancedPicker(model: PickerModel): boolean {
  return model.kind === "single" && model.questionnaire === undefined && model.title === ADVANCED_TITLE;
}

function isScopePicker(model: PickerModel): boolean {
  return model.kind === "single" && model.questionnaire === undefined && model.title === SCOPE_TITLE;
}

function stripNativeSuffix(label: string): string {
  return label.trim().replace(/(?:\s+\((?:default|current)\))+$/i, "");
}

function modelField(lines: ReturnType<typeof splitLines>, model: string): { model: string; effort: CodexReasoningEffort | null } | null {
  const statusLines = codexAdapter.extractStatusLines(lines);
  for (const row of statusLines) {
    const text = lineText(row).trim();
    const parts = text.split(/\s+·\s+/);
    for (const field of [text, ...parts]) {
      const parsed = parseCodexModelField(field, [model]);
      if (parsed?.model === model) return parsed;
    }
  }
  return null;
}

function freshConfirmation(beforeText: string, afterText: string, preset: CodexModelPreset): boolean {
  if (beforeText === afterText) return false;
  const model = preset.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const effort = preset.effort === "xhigh"
    ? "(?:xhigh|extra\\s+high)"
    : preset.effort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\bModel changed(?: to)?\\s+${model}\\s+${effort}(?:\\s+for Plan mode)?[.!]?\\s*$`, "i");
  const count = (text: string): number => splitLines(parseAnsi(text)).filter((line) => pattern.test(lineText(line).trim())).length;
  return count(afterText) > count(beforeText);
}

function statusMatches(text: string, preset: CodexModelPreset): boolean {
  const lines = splitLines(parseAnsi(text));
  return modelField(lines, preset.model)?.effort === preset.effort;
}

function detectPicker(text: string): PickerModel | null {
  const blocks = codexAdapter.buildBlocks(splitLines(parseAnsi(text)));
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index]!;
    if (block.kind === "picker") return block.picker;
  }
  return null;
}

function mapReply(outcome: ReplyOutcome, signal: AbortSignal): CodexModelSwitchResult | null {
  if (isCancelled(signal)) return result("cancelled");
  if (outcome.status === "sent") return null;
  if (outcome.status === "blocked") return result("blocked", outcome.error);
  if (outcome.status === "error") return result("error", outcome.error);
  return result("unconfirmed", outcome.error);
}

function mapPickerAction(action: ActionResult, signal: AbortSignal): CodexModelSwitchResult | null {
  if (isCancelled(signal)) return result("cancelled");
  if (action.status === "sent") return null;
  if (action.status === "changed") return result("changed");
  return result("error", action.error);
}

async function readFreshPane(args: CodexModelSwitchArgs): Promise<FreshPane | CodexModelSwitchResult> {
  if (isCancelled(args.signal)) return result("cancelled");
  let snapshot;
  try {
    snapshot = await fetchSnapshot(args.scope, args.signal);
  } catch (error) {
    return isCancelled(args.signal) ? result("cancelled") : result("error", describeThrownError(error));
  }
  if (isCancelled(args.signal)) return result("cancelled");
  const pane = [...snapshot.agents, ...snapshot.shellPanes].find((candidate) => candidate.paneId === args.paneId);
  if (!pane || pane.agent !== "codex") return result("blocked");
  if (pane.status !== "idle" && pane.status !== "done") return result("blocked");

  let read;
  try {
    read = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
  } catch (error) {
    return isCancelled(args.signal) ? result("cancelled") : result("error", describeThrownError(error));
  }
  if (isCancelled(args.signal)) return result("cancelled");
  const lines = splitLines(parseAnsi(read.text));
  if (!codexAdapter.composerReady?.(lines)) return result("blocked");
  if (codexAdapter.extractInputDraft(lines) !== null) return result("blocked");
  if (codexAdapter.buildBlocks(lines).some(blockOwnsKeyboard)) return result("blocked");
  return { text: read.text, revision: read.revision, lines };
}

async function readPicker(args: CodexModelSwitchArgs): Promise<PickerRead | null> {
  if (isCancelled(args.signal)) return null;
  try {
    const read = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
    if (isCancelled(args.signal)) return null;
    const model = detectPicker(read.text);
    return model ? { model, revision: read.revision, text: read.text } : null;
  } catch {
    return null;
  }
}

async function waitForPicker(
  args: CodexModelSwitchArgs,
  accept: (model: PickerModel) => boolean,
): Promise<PickerRead | null> {
  const sleep = args.sleep ?? defaultSleep;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (isCancelled(args.signal)) return null;
    if (attempt > 0) await sleep(POLL_DELAY_MS);
    if (isCancelled(args.signal)) return null;
    const read = await readPicker(args);
    if (read && accept(read.model)) return read;
  }
  return null;
}

function pickerArgs(
  args: CodexModelSwitchArgs,
  owner: PaneActionOwner,
  read: PickerRead,
  intent: Parameters<typeof submitPickerIntent>[0]["intent"],
) {
  return {
    paneId: args.paneId,
    requestedLines: args.requestedLines,
    detectedRevision: read.revision,
    picker: read.model,
    intent,
    scope: args.scope,
    agent: "codex",
    sleep: args.sleep,
    signal: args.signal,
    owner,
  };
}

async function pickerAction(
  args: CodexModelSwitchArgs,
  owner: PaneActionOwner,
  read: PickerRead,
  intent: Parameters<typeof submitPickerIntent>[0]["intent"],
): Promise<CodexModelSwitchResult | null> {
  if (isCancelled(args.signal)) return result("cancelled");
  const action = await submitPickerIntent(pickerArgs(args, owner, read, intent));
  return mapPickerAction(action, args.signal);
}

async function chooseVisible(
  args: CodexModelSwitchArgs,
  owner: PaneActionOwner,
  read: PickerRead,
  id: string,
): Promise<CodexModelSwitchResult | null> {
  return pickerAction(args, owner, read, { kind: "choose", id });
}

async function locateModel(
  args: CodexModelSwitchArgs,
  owner: PaneActionOwner,
  initial: PickerRead,
  preset: CodexModelPreset,
): Promise<PickerRead | CodexModelSwitchResult> {
  let current = initial;
  let direction: "up" | "down" = "down";
  let reversed = false;
  let seen = new Set<string>();
  for (let step = 0; step < MAX_MODEL_BROWSE_STEPS; step++) {
    if (isCancelled(args.signal)) return result("cancelled");
    if (!isModelPicker(current.model)) return result("changed");
    const option = current.model.options.find((candidate) => stripNativeSuffix(candidate.label) === preset.model);
    if (option) return current;
    const fingerprint = current.model.signature;
    if (seen.has(fingerprint)) return result("unsupported-model");
    seen.add(fingerprint);
    const navigated = await pickerAction(args, owner, current, { kind: "navigate", direction });
    if (navigated) return navigated;
    const next = await waitForPicker(args, (model) => isModelPicker(model));
    if (!next) return isCancelled(args.signal) ? result("cancelled") : result("changed");
    if (next.model.signature === fingerprint) {
      if (reversed) return result("unsupported-model");
      direction = "up";
      reversed = true;
      seen = new Set();
      continue;
    }
    current = next;
  }
  return result("unsupported-model");
}

function effortOption(model: PickerModel, effort: CodexReasoningEffort): { id: string; advanced: boolean } | null {
  const direct = model.options.find((option) => stripNativeSuffix(option.label).toLowerCase() === effort);
  if (direct) return { id: direct.id, advanced: false };
  if (effort === "xhigh") {
    const extra = model.options.find((option) => stripNativeSuffix(option.label).toLowerCase() === "extra high");
    if (extra) return { id: extra.id, advanced: false };
  }
  if (effort === "max" || effort === "ultra") {
    const advanced = model.options.find((option) => stripNativeSuffix(option.label).toLowerCase() === "more reasoning…" || stripNativeSuffix(option.label).toLowerCase() === "more reasoning...");
    if (advanced) return { id: advanced.id, advanced: true };
  }
  return null;
}

function advancedOption(model: PickerModel, effort: CodexReasoningEffort): string | null {
  return model.options.find((option) => stripNativeSuffix(option.label).toLowerCase() === effort)?.id ?? null;
}

function globalPlanOption(model: PickerModel): string | null {
  return model.options.find((option) => /^apply(?: to)? global default\b/i.test(stripNativeSuffix(option.label)))?.id ?? null;
}

async function finishAndVerify(
  args: CodexModelSwitchArgs,
  baselineText: string,
  preset: CodexModelPreset,
): Promise<CodexModelSwitchResult> {
  const sleep = args.sleep ?? defaultSleep;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (isCancelled(args.signal)) return result("cancelled");
    if (attempt > 0) await sleep(POLL_DELAY_MS);
    if (isCancelled(args.signal)) return result("cancelled");
    try {
      const read = await fetchPane(args.paneId, args.requestedLines, args.scope, args.signal);
      if (isCancelled(args.signal)) return result("cancelled");
      const picker = detectPicker(read.text);
      if (picker !== null) {
        // A successor picker is handled by the caller; any leftover picker means the final key did
        // not commit, so never report success just because the command output changed.
        continue;
      }
      if (statusMatches(read.text, preset) || freshConfirmation(baselineText, read.text, preset)) {
        return result("switched");
      }
    } catch {
      // Bounded read-only retry; no terminal key is repeated on verification failure.
    }
  }
  return isCancelled(args.signal) ? result("cancelled") : result("unconfirmed");
}

async function drive(
  args: CodexModelSwitchArgs,
  owner: PaneActionOwner,
  fresh: FreshPane,
): Promise<CodexModelSwitchResult> {
  if (args.preset && statusMatches(fresh.text, args.preset)) return result("switched");
  const opened = await sendGuardedReply({
    paneId: args.paneId,
    text: "/model",
    agent: "codex",
    scope: args.scope,
    requestedLines: args.requestedLines,
    signal: args.signal,
    owner,
    requireComposer: true,
    onComposerSeen: async () => {
      const read = await readFreshPane(args);
      return "status" in read
        ? { ok: false, error: read.error ?? "Codex composer changed before the model picker opened." }
        : { ok: true, keysSent: false };
    },
  });
  const openResult = mapReply(opened, args.signal);
  if (openResult) return openResult;
  const modelPicker = await waitForPicker(args, isModelPicker);
  if (!modelPicker) return isCancelled(args.signal) ? result("cancelled") : result("unconfirmed");
  if (!args.preset) return result("opened");

  const modelRead = await locateModel(args, owner, modelPicker, args.preset);
  if ("status" in modelRead) return modelRead;
  const modelOption = modelRead.model.options.find((option) => stripNativeSuffix(option.label) === args.preset!.model);
  if (!modelOption) return result("unsupported-model");
  const choseModel = await chooseVisible(args, owner, modelRead, modelOption.id);
  if (choseModel) return choseModel;

  const next = await waitForPicker(
    args,
    (model) => isEffortPickerFor(model, args.preset!.model) || isAdvancedPicker(model) || isScopePicker(model),
  );
  if (!next) return isCancelled(args.signal) ? result("cancelled") : await finishAndVerify(args, fresh.text, args.preset);

  let stage = next;
  if (isEffortPickerFor(stage.model, args.preset.model)) {
    const effort = effortOption(stage.model, args.preset.effort);
    if (!effort) return result("unsupported-effort");
    const choseEffort = await chooseVisible(args, owner, stage, effort.id);
    if (choseEffort) return choseEffort;
    stage = (await waitForPicker(args, (model) => isAdvancedPicker(model) || isScopePicker(model))) ?? stage;
    if (isEffortPickerFor(stage.model, args.preset.model)) return await finishAndVerify(args, fresh.text, args.preset);
  }

  if (isAdvancedPicker(stage.model)) {
    if (args.preset.effort !== "max" && args.preset.effort !== "ultra") return result("unsupported-effort");
    const id = advancedOption(stage.model, args.preset.effort);
    if (!id) return result("unsupported-effort");
    const choseAdvanced = await chooseVisible(args, owner, stage, id);
    if (choseAdvanced) return choseAdvanced;
    stage = (await waitForPicker(args, isScopePicker)) ?? stage;
    if (isAdvancedPicker(stage.model)) return await finishAndVerify(args, fresh.text, args.preset);
  }

  if (isScopePicker(stage.model)) {
    const id = globalPlanOption(stage.model);
    if (!id) return result("unsupported-effort");
    const choseScope = await chooseVisible(args, owner, stage, id);
    if (choseScope) return choseScope;
  }

  return finishAndVerify(args, fresh.text, args.preset);
}

/** Guarded native Codex `/model` flow. No preset only opens the native model picker. */
export async function runCodexModelSwitch(args: CodexModelSwitchArgs): Promise<CodexModelSwitchResult> {
  if (isCancelled(args.signal)) return result("cancelled");
  const owner = acquirePaneAction(args.paneId, args.scope);
  if (!owner) return result("changed");
  try {
    const fresh = await readFreshPane(args);
    if ("status" in fresh) return fresh;
    return await drive(args, owner, fresh);
  } finally {
    releasePaneAction(owner);
  }
}
