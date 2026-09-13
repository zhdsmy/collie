// Codex picker actions. A picker is deliberately driven through the terminal's own focus model:
// the browser may render a row as a card, but the only safe way to activate it is to walk the
// native pointer there, verify the resulting screen, and then send the committing key once.
//
// Unlike Claude's numbered multi-select, Codex's status-line picker has no digit shortcuts. Its
// keys are Up/Down (focus), Space (toggle), Left/Right (reorder), Enter (save), and Escape
// (cancel). Search is an input inside the picker: replace it with Backspace + raw unsubmitted text;
// Enter must never be used to apply a search because Codex reserves it for saving the picker.

import { sendReply } from "./api";
import { describeApiError, describeThrownError } from "./api-error-message";
import {
  guardDialog,
  readDialog,
  sendBoundKeys,
  type DialogTarget,
} from "./dialog-guard";
import {
  sanitizePickerSearchQuery,
  pickersSameIdentity,
  type PickerIntent,
  type PickerModel,
} from "./harness/picker-model";
import { POLL_ATTEMPTS, defaultSleep, type ActionResult, type Sleep } from "./harness/guard";
import { paneScopeKey, type Scope } from "./scope";

/** Arguments shared by the picker renderer and the action choreography. */
export interface PickerActionArgs {
  paneId: string;
  requestedLines: number;
  /** Revision against which the picker was rendered. */
  detectedRevision: number;
  picker: PickerModel;
  intent: PickerIntent;
  /** Which host/session owns the pane. */
  scope?: Scope;
  /** Agent whose adapter emitted the picker. */
  agent?: string;
  /** Test seam for bounded read-back pacing. */
  sleep?: Sleep;
}

function target(args: Omit<PickerActionArgs, "intent">): DialogTarget<"picker"> {
  return { ...args, kind: "picker", model: args.picker };
}

// One browser context can render the same pane in more than one component for a short period while
// revalidation is in flight. Serialize all picker actions per addressed pane so two pointer walks
// cannot interleave and make a later Enter activate a row the operator never saw.
const inFlight = new Set<string>();

function pickerKey(paneId: string, scope: Scope | undefined): string {
  return paneScopeKey(scope, paneId);
}

interface PickerRead {
  model: PickerModel;
  revision: number;
}

type Flow<T> = { ok: true; value: T } | { ok: false; result: ActionResult };

function changed<T>(): Flow<T> {
  return { ok: false, result: { status: "changed" } };
}

function result<T>(value: T): Flow<T> {
  return { ok: true, value };
}

function argsFor(
  args: PickerActionArgs,
  read: PickerRead,
): Omit<PickerActionArgs, "intent"> {
  return {
    paneId: args.paneId,
    requestedLines: args.requestedLines,
    detectedRevision: read.revision,
    picker: read.model,
    scope: args.scope,
    agent: args.agent,
    sleep: args.sleep,
  };
}

function optionIdAt(model: PickerModel, index: number): string | null {
  return model.options[index]?.id ?? null;
}

function pointedOption(model: PickerModel): { id: string; index: number } | null {
  let found: { id: string; index: number } | null = null;
  for (let i = 0; i < model.options.length; i++) {
    const option = model.options[i]!;
    if (!option.pointed) continue;
    // Two pointed rows means the terminal is mid-redraw or the grammar is ambiguous. Fail closed
    // instead of guessing which card owns the next key.
    if (found) return null;
    found = { id: option.id, index: i };
  }
  return found;
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

interface OptionFacts {
  id: string;
  label: string;
  description: string;
  current: boolean;
  checked: boolean;
  orderable: boolean;
}

function optionFacts(model: PickerModel): OptionFacts[] {
  return model.options.map((option) => ({
    id: option.id,
    label: option.label,
    description: option.description,
    current: option.current,
    checked: option.checked,
    orderable: option.orderable,
  }));
}

function sameOptionFacts(a: OptionFacts, b: OptionFacts): boolean {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.description === b.description &&
    a.current === b.current &&
    a.checked === b.checked &&
    a.orderable === b.orderable
  );
}

function sameOptionFactsExceptChecked(a: OptionFacts, b: OptionFacts): boolean {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.description === b.description &&
    a.current === b.current &&
    a.orderable === b.orderable
  );
}

function samePreview(a: PickerModel, b: PickerModel): boolean {
  if (a.preview.length !== b.preview.length) return false;
  return a.preview.every((line, index) => {
    const other = b.preview[index]!;
    if (line.segments.length !== other.segments.length) return false;
    return line.segments.every((segment, segmentIndex) => {
      const otherSegment = other.segments[segmentIndex]!;
      return (
        segment.text === otherSegment.text &&
        segment.fg === otherSegment.fg &&
        segment.bg === otherSegment.bg &&
        segment.bold === otherSegment.bold &&
        segment.dim === otherSegment.dim &&
        segment.italic === otherSegment.italic &&
        segment.underline === otherSegment.underline &&
        segment.strike === otherSegment.strike &&
        segment.muted === otherSegment.muted
      );
    });
  });
}

/**
 * Compare the picker while ignoring only the transient pointer marker. This is used for every
 * Up/Down step: a changed query, checked value, ordering, title, or preview is a real race and
 * must stop the walk before another key lands on the replacement screen.
 */
function samePickerExceptPointer(a: PickerModel, b: PickerModel): boolean {
  if (!pickersSameIdentity(a, b)) return false;
  if (a.kind !== b.kind || a.title !== b.title || !sameStrings(a.description, b.description)) {
    return false;
  }
  if (a.query !== b.query || a.footer !== b.footer || !samePreview(a, b)) return false;
  const af = optionFacts(a);
  const bf = optionFacts(b);
  return af.length === bf.length && af.every((value, index) => sameOptionFacts(value, bf[index]!));
}

/**
 * Compare two visible windows for a navigation step. Codex may scroll the list by one row at a
 * viewport edge, so the arrays do not have to contain the same IDs. Every shared row must retain
 * its label, state, and relative order; an empty intersection is not enough evidence of continuity.
 */
function samePickerWindow(a: PickerModel, b: PickerModel): boolean {
  if (!pickersSameIdentity(a, b)) return false;
  if (a.kind !== b.kind || a.title !== b.title || a.query !== b.query) return false;
  if (!sameStrings(a.description, b.description)) return false;

  const before = optionFacts(a);
  const after = optionFacts(b);
  const afterById = new Map(after.map((option) => [option.id, option]));
  const sharedBefore = before.filter((option) => afterById.has(option.id));
  const sharedAfter = after.filter((option) => before.some((optionBefore) => optionBefore.id === option.id));
  if (sharedBefore.length === 0 || sharedBefore.length !== sharedAfter.length) return false;
  return (
    sharedBefore.every((option, index) => {
      const other = sharedAfter[index]!;
      return option.id === other.id && sameOptionFacts(option, other);
    })
  );
}

/** Same picker stage and option facts, allowing both filtering and order/window changes. */
function samePickerExceptOrder(a: PickerModel, b: PickerModel): boolean {
  if (!pickersSameIdentity(a, b)) return false;
  if (a.kind !== b.kind || a.title !== b.title || a.query !== b.query) return false;
  if (!sameStrings(a.description, b.description)) return false;

  const before = new Map(optionFacts(a).map((option) => [option.id, option]));
  const after = optionFacts(b);
  const shared = after.filter((option) => before.has(option.id));
  if (shared.length === 0) return false;
  return shared.every((option) => {
    const previous = before.get(option.id);
    return previous !== undefined && sameOptionFacts(previous, option);
  });
}

function expectedSharedOrder(
  baseline: PickerModel,
  fresh: PickerModel,
  expectedOrder: readonly string[],
): boolean {
  const baselineIds = new Set(baseline.options.map((option) => option.id));
  const visibleFreshIds = new Set(fresh.options.map((option) => option.id));
  const expected = expectedOrder.filter((id) => baselineIds.has(id) && visibleFreshIds.has(id));
  const actual = fresh.options
    .map((option) => option.id)
    .filter((id) => baselineIds.has(id));
  return sameStrings(actual, expected);
}

/** Compare option facts shared by two search results while allowing filtering to add/remove rows. */
function sameSearchFacts(a: PickerModel, b: PickerModel): boolean {
  if (!samePickerStage(a, b)) return false;
  if (a.footer !== b.footer || !samePreview(a, b)) return false;
  const before = optionFacts(a);
  const afterById = new Map(optionFacts(b).map((option) => [option.id, option]));
  const shared = before.filter((option) => afterById.has(option.id));
  const afterShared = optionFacts(b).filter((option) => before.some((candidate) => candidate.id === option.id));
  return (
    shared.length === afterShared.length &&
    shared.every((option, index) => {
      const other = afterShared[index]!;
      return option.id === other.id && sameOptionFacts(option, other);
    })
  );
}

function samePickerStage(a: PickerModel, b: PickerModel): boolean {
  return (
    pickersSameIdentity(a, b) &&
    a.kind === b.kind &&
    a.title === b.title &&
    sameStrings(a.description, b.description)
  );
}

/** The only expected mutation after Space: one checkbox flips, pointer/order/query stay stable. */
function toggleAccepted(baseline: PickerModel, fresh: PickerModel, id: string): boolean {
  if (!samePickerStage(baseline, fresh)) return false;
  if (baseline.query !== fresh.query || baseline.footer !== fresh.footer) return false;
  if (baseline.options.length !== fresh.options.length) return false;

  const before = optionFacts(baseline);
  const after = optionFacts(fresh);
  let flipped = false;
  for (let index = 0; index < baseline.options.length; index++) {
    const beforeOption = baseline.options[index]!;
    const afterOption = fresh.options[index]!;
    if (beforeOption.id !== afterOption.id || beforeOption.pointed !== afterOption.pointed) {
      return false;
    }
    if (beforeOption.id === id) {
      if (
        beforeOption.checked === afterOption.checked ||
        !sameOptionFactsExceptChecked(before[index]!, after[index]!)
      ) {
        return false;
      }
      flipped = true;
    } else if (!sameOptionFacts(before[index]!, after[index]!)) {
      return false;
    }
  }
  return flipped;
}

async function readPicker(args: Omit<PickerActionArgs, "intent">): Promise<PickerRead | null> {
  try {
    const fresh = await readDialog(target(args));
    return fresh.model ? { model: fresh.model, revision: fresh.revision } : null;
  } catch {
    return null;
  }
}

/** Read the current pointer before calculating a walk. */
async function readCurrent(args: PickerActionArgs): Promise<Flow<PickerRead>> {
  // The first read is a full committing guard. A pointer that moved after rendering is meaningful
  // here: the card was rendered against a different target, so refuse the action and let the next
  // poll re-render it. The same strict guard is repeated after every arrow below.
  const guarded = await guardDialog(target(args));
  if (!guarded.ok) return { ok: false, result: guarded.result };
  const fresh = await readPicker(args);
  if (!fresh || !samePickerExceptPointer(args.picker, fresh.model)) return changed();
  return result(fresh);
}

/**
 * Wait for one expected picker state. Null/torn redraws are retried as reads only; a different
 * identity is an immediate drift. No key is retried here.
 */
async function readBack(
  args: Omit<PickerActionArgs, "intent">,
  baseline: PickerModel,
  accept: (model: PickerModel) => boolean,
): Promise<PickerRead | null> {
  const sleep = args.sleep ?? defaultSleep;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await sleep(250);
    const fresh = await readPicker(args);
    if (!fresh) continue;
    if (!samePickerStage(baseline, fresh.model)) return null;
    if (accept(fresh.model)) return fresh;
  }
  return null;
}

/** Read the outcome of a committing key without ever sending that key again. */
async function readCommitOutcome(
  args: Omit<PickerActionArgs, "intent">,
  baseline: PickerModel,
  accept: (model: PickerModel) => boolean,
  closed: boolean,
  successor: boolean,
): Promise<ActionResult> {
  const sleep = args.sleep ?? defaultSleep;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await sleep(250);
    let fresh: PickerRead | null;
    try {
      const read = await readDialog(target(args));
      fresh = read.model ? { model: read.model, revision: read.revision } : null;
    } catch {
      continue;
    }
    if (!fresh) {
      // Enter/Escape are expected to close the picker. A null model is the only evidence available
      // for that transition, and no further committing key is sent on this path.
      if (closed) return { status: "sent" };
      continue;
    }
    if (accept(fresh.model)) return { status: "sent" };
    // Model selection can replace the picker with an effort/scope screen. That successor is a
    // successful transition only for a single-picker choice; toggle/close actions must not
    // mistake an unrelated picker for confirmation.
    if (successor && !samePickerStage(baseline, fresh.model)) return { status: "sent" };
  }
  return { status: "changed" };
}

/** Send one key after a full guard. The model/revision pair must be fresh for every write. */
async function guardedKey(
  args: Omit<PickerActionArgs, "intent">,
  keys: string[],
): Promise<ActionResult> {
  const guarded = await guardDialog(target(args));
  if (!guarded.ok) return guarded.result;
  return sendBoundKeys(args, keys, guarded.region);
}

/** Move the native pointer to one visible option, reading after every arrow. */
async function walkTo(
  args: PickerActionArgs,
  initial: PickerRead,
  id: string,
): Promise<Flow<PickerRead>> {
  let current = initial;
  const maxSteps = current.model.options.length + 2;
  for (let step = 0; step < maxSteps; step++) {
    const pointer = pointedOption(current.model);
    const targetIndex = current.model.options.findIndex((option) => option.id === id);
    if (!pointer || targetIndex < 0) return changed();
    if (pointer.id === id) return result(current);

    const direction = targetIndex > pointer.index ? "Down" : "Up";
    const expectedPointerId = optionIdAt(
      current.model,
      pointer.index + (direction === "Down" ? 1 : -1),
    );
    if (!expectedPointerId) return changed();
    const currentArgs = argsFor(args, current);
    const sent = await guardedKey(currentArgs, [direction]);
    if (sent.status !== "sent") return { ok: false, result: sent };

    const previousPointer = pointer.id;
    const next = await readBack(currentArgs, current.model, (model) => {
      const nextPointer = pointedOption(model);
      return (
        samePickerExceptPointer(current.model, model) &&
        nextPointer !== null &&
        nextPointer.id !== previousPointer &&
        nextPointer.id === expectedPointerId
      );
    });
    if (!next) return changed();
    current = next;
  }
  return changed();
}

async function commitAt(
  args: PickerActionArgs,
  current: PickerRead,
  id: string,
  key: "Enter" | "Space",
): Promise<ActionResult> {
  const pointer = pointedOption(current.model);
  if (!pointer || pointer.id !== id) return { status: "changed" };
  // The read-back model is the target. The full guard below re-reads it once more and refuses if a
  // different option, checkbox state, query, or successor picker appeared in the meantime.
  const currentArgs = argsFor(args, current);
  const sent = await guardedKey(currentArgs, [key]);
  if (sent.status !== "sent") return sent;
  return readCommitOutcome(
    currentArgs,
    current.model,
    key === "Space" ? (model) => toggleAccepted(current.model, model, id) : () => false,
    key === "Enter",
    key === "Enter",
  );
}

async function runChoose(args: PickerActionArgs, id: string): Promise<ActionResult> {
  if (args.picker.kind !== "single") return { status: "changed" };
  const initial = await readCurrent(args);
  if (!initial.ok) return initial.result;
  const walked = await walkTo(args, initial.value, id);
  if (!walked.ok) return walked.result;
  return commitAt(args, walked.value, id, "Enter");
}

async function runToggle(args: PickerActionArgs, id: string): Promise<ActionResult> {
  if (args.picker.kind !== "multiple") return { status: "changed" };
  const option = args.picker.options.find((candidate) => candidate.id === id);
  if (!option) return { status: "changed" };
  const initial = await readCurrent(args);
  if (!initial.ok) return initial.result;
  const walked = await walkTo(args, initial.value, id);
  if (!walked.ok) return walked.result;
  return commitAt(args, walked.value, id, "Space");
}

async function runClose(
  args: PickerActionArgs,
  intent: "confirm" | "cancel",
): Promise<ActionResult> {
  if (intent === "confirm" && args.picker.kind !== "multiple") {
    return { status: "changed" };
  }
  const key = intent === "confirm" ? "Enter" : "Escape";
  const sent = await guardedKey(args, [key]);
  if (sent.status !== "sent") return sent;
  return readCommitOutcome(args, args.picker, () => false, true, false);
}

async function runNavigate(
  args: PickerActionArgs,
  direction: "up" | "down",
): Promise<ActionResult> {
  const initial = await readCurrent(args);
  if (!initial.ok) return initial.result;
  const pointer = pointedOption(initial.value.model);
  if (!pointer) return { status: "changed" };
  const delta = direction === "down" ? 1 : -1;
  const expectedId = optionIdAt(initial.value.model, pointer.index + delta);

  const currentArgs = argsFor(args, initial.value);
  const sent = await guardedKey(currentArgs, [direction === "down" ? "Down" : "Up"]);
  if (sent.status !== "sent") return sent;
  const next = await readBack(currentArgs, initial.value.model, (model) => {
    const nextPointer = pointedOption(model);
    if (!nextPointer) return false;
    const atVisibleEdge = direction === "down"
      ? pointer.index === initial.value.model.options.length - 1
      : pointer.index === 0;

    // A native list may clamp at a boundary or wrap to the opposite edge. Accept either only
    // when the rest of the picker is unchanged, so a swallowed key or unrelated redraw cannot
    // masquerade as successful navigation in the middle of the list.
    if (atVisibleEdge && samePickerExceptPointer(initial.value.model, model)) {
      if (nextPointer.id === pointer.id) return true;
      return direction === "down"
        ? nextPointer.index === 0
        : nextPointer.index === model.options.length - 1;
    }

    if (expectedId !== null) {
      if (nextPointer.id === pointer.id) return false;
      return samePickerExceptPointer(initial.value.model, model) && nextPointer.id === expectedId;
    }
    // At a visible edge the next row may enter the window. Require the pointer to settle at the
    // corresponding edge and validate every row that remained visible across the scroll.
    // A long list can instead wrap from the first window to the last (or vice versa), leaving no
    // shared rows to compare. Navigation is noncommittal, so same stage/chrome plus the opposite
    // edge is the strongest evidence available for that native wrap; this is intentionally local
    // to navigation and is never used to authorize a picker commit or pointer walk.
    if (
      atVisibleEdge &&
      samePickerStage(initial.value.model, model) &&
      initial.value.model.query === model.query &&
      initial.value.model.footer === model.footer &&
      samePreview(initial.value.model, model) &&
      (direction === "down"
        ? nextPointer.index === 0
        : nextPointer.index === model.options.length - 1)
    ) {
      return true;
    }
    return (
      samePickerWindow(initial.value.model, model) &&
      (direction === "down"
        ? nextPointer.index === model.options.length - 1
        : nextPointer.index === 0)
    );
  });
  return next ? { status: "sent" } : { status: "changed" };
}

async function runMove(
  args: PickerActionArgs,
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  if (
    args.picker.kind !== "multiple" ||
    (args.picker.query !== null && args.picker.query !== "")
  ) {
    return { status: "changed" };
  }
  const option = args.picker.options.find((candidate) => candidate.id === id);
  if (!option || !option.orderable) return { status: "changed" };

  const initial = await readCurrent(args);
  if (!initial.ok) return initial.result;
  const walked = await walkTo(args, initial.value, id);
  if (!walked.ok) return walked.result;

  const index = walked.value.model.options.findIndex((candidate) => candidate.id === id);
  const delta = direction === "up" ? -1 : 1;
  const neighbor = walked.value.model.options[index + delta];
  if (index < 0 || !neighbor || !neighbor.orderable) return { status: "changed" };

  const expectedOrder = walked.value.model.options.map((candidate) => candidate.id);
  [expectedOrder[index], expectedOrder[index + delta]] = [
    expectedOrder[index + delta]!,
    expectedOrder[index]!,
  ];
  const currentArgs = argsFor(args, walked.value);
  const sent = await guardedKey(currentArgs, [direction === "up" ? "Left" : "Right"]);
  if (sent.status !== "sent") return sent;

  const next = await readBack(currentArgs, walked.value.model, (model) => {
    return (
      samePickerExceptOrder(walked.value.model, model) &&
      expectedSharedOrder(walked.value.model, model, expectedOrder) &&
      model.options.some((candidate) => candidate.id === id) &&
      model.options.some((candidate) => candidate.id === neighbor.id) &&
      pointedOption(model)?.id === id
    );
  });
  return next ? { status: "sent" } : { status: "changed" };
}

async function sendSearchText(
  args: Omit<PickerActionArgs, "intent">,
  text: string,
): Promise<ActionResult> {
  try {
    const response = await sendReply(args.paneId, text, false, args.scope, args.picker.regionSignature);
    if (!response.ok && response.code === "prompt_changed") return { status: "changed" };
    if (!response.ok) return { status: "error", error: describeApiError(response) };
    return { status: "sent" };
  } catch (error) {
    return { status: "error", error: describeThrownError(error) };
  }
}

async function runSearch(args: PickerActionArgs, query: string): Promise<ActionResult> {
  if (args.picker.kind !== "multiple" || args.picker.query === null) {
    return { status: "changed" };
  }
  const nextQuery = sanitizePickerSearchQuery(query);
  if (args.picker.query === nextQuery) return { status: "sent" };

  const initial = await readCurrent(args);
  if (!initial.ok) return initial.result;
  const currentQuery = initial.value.model.query;
  if (currentQuery === null) return { status: "changed" };

  if (currentQuery.length > 0) {
    const currentArgs = argsFor(args, initial.value);
    const clear = await guardedKey(
      currentArgs,
      Array.from(currentQuery, () => "Backspace"),
    );
    if (clear.status !== "sent") return clear;
    const cleared = await readBack(currentArgs, initial.value.model, (model) => {
      return sameSearchFacts(initial.value.model, model) && model.query === "";
    });
    if (!cleared) return { status: "changed" };
    if (nextQuery.length === 0) return { status: "sent" };
    const typed = await sendSearchText(argsFor(args, cleared), nextQuery);
    if (typed.status !== "sent") return typed;
    const landed = await readBack(argsFor(args, cleared), cleared.model, (model) => {
      return sameSearchFacts(cleared.model, model) && model.query === nextQuery;
    });
    return landed ? { status: "sent" } : { status: "changed" };
  }

  if (nextQuery.length === 0) return { status: "sent" };
  const typed = await sendSearchText(argsFor(args, initial.value), nextQuery);
  if (typed.status !== "sent") return typed;
  const landed = await readBack(argsFor(args, initial.value), initial.value.model, (model) => {
    return sameSearchFacts(initial.value.model, model) && model.query === nextQuery;
  });
  return landed ? { status: "sent" } : { status: "changed" };
}

async function dispatch(args: PickerActionArgs): Promise<ActionResult> {
  switch (args.intent.kind) {
    case "choose":
      return runChoose(args, args.intent.id);
    case "toggle":
      return runToggle(args, args.intent.id);
    case "move":
      return runMove(args, args.intent.id, args.intent.direction);
    case "navigate":
      return runNavigate(args, args.intent.direction);
    case "search":
      return runSearch(args, args.intent.query);
    case "confirm":
      return runClose(args, "confirm");
    case "cancel":
      return runClose(args, "cancel");
  }
}

/** Submit one picker intent, serialized per host/session/pane. */
export async function submitPickerIntent(args: PickerActionArgs): Promise<ActionResult> {
  const key = pickerKey(args.paneId, args.scope);
  if (inFlight.has(key)) return { status: "changed" };
  inFlight.add(key);
  try {
    return await dispatch(args);
  } finally {
    inFlight.delete(key);
  }
}
