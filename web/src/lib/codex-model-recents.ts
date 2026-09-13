import { useSyncExternalStore } from "react";

import { asJsonObject, asJsonString, parseJson } from "@/lib/json";
import {
  CODEX_REASONING_EFFORTS,
  type CodexModelTarget,
  type CodexReasoningEffort,
} from "@/lib/harness/codex/model-field";

// The RECENTLY-USED Codex models, per device — the pairs the operator has actually started a turn
// with, most recent first. It is the replacement for the hand-edited preset list (`codex-model-
// presets.ts`, deleted): a list you had to curate by hand recorded nothing about what you use, and
// the one thing this has to get right is which combinations you reach for.
//
// ── WHY THERE IS NO ADD-ONE-BY-HAND ROW ──────────────────────────────────────
// That is the first thing to want back, so here is the whole argument. A hand-written row is a claim
// about a model that has not run, and Codex is the only thing that can honour it: a name it does not
// serve comes back `unsupported-model` from a driver that has to walk a native picker to find out.
// The list's job is the opposite — it holds pairs that are PROVEN to work, each one having already
// carried a reply, which is what makes a single tap on it safe. The cost this buys is real and
// accepted: a private, non-`gpt-*` model id can no longer be taught to Collie, because a statusline
// only starts being read as a model field once the id is known (`knownModels`, derived from this
// list). Anyone who needs that back should re-add a teaching path, not a free-text row.
//
// ORDER IS THE ONLY DATUM. The pair `(model, effort)` is the identity — the old list's generated
// `id` was already redundant, because its own validator refused two rows with the same pair. There is
// no timestamp either: nothing displays one, nothing prunes by one, and a field nothing reads is a
// field that would only invite a redundant write.
//
// Module-scoped `useSyncExternalStore`, no provider — the shape the store it replaces used, and the
// same one `lib/i18n/index.ts` uses: several readers agree without prop-drilling, and it survives the
// router unmounting.

/** How many pairs this device remembers. Older ones fall off the end. */
export const CODEX_MODEL_RECENTS_MAX = 8;

export const CODEX_MODEL_RECENTS_STORAGE_KEY = "collie:codex-model-recents:v1";

const listeners = new Set<() => void>();

/** The whole store. Frozen, and replaced only when it actually changes, so a snapshot stays stable. */
let recents: readonly CodexModelTarget[] = parse(readStored());

function freezeRecents(next: readonly CodexModelTarget[]): readonly CodexModelTarget[] {
  return Object.freeze(next.map((entry) => Object.freeze({ ...entry })));
}

function samePair(a: CodexModelTarget, b: CodexModelTarget): boolean {
  return a.model === b.model && a.effort === b.effort;
}

function validModel(model: string): boolean {
  return model.length > 0 && !/[\p{C}\s]/u.test(model);
}

function validEffort(effort: string): effort is CodexReasoningEffort {
  return CODEX_REASONING_EFFORTS.some((candidate) => candidate === effort);
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return storage()?.getItem(CODEX_MODEL_RECENTS_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(next: readonly CodexModelTarget[]): void {
  try {
    storage()?.setItem(CODEX_MODEL_RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode, a quota, no storage at all: this session still works, it just will not persist.
    // The old store surfaced a boolean here because its editor had a "couldn't save" alert; nothing
    // in this one can report a failure the operator could act on.
  }
}

/**
 * The stored list, or `[]` for anything that is not one — an absent key, a corrupt payload, a hand
 * edit. All-or-nothing per entry, like the store this replaces: salvaging the good rows out of a
 * blob somebody has been editing would quietly resurrect a list nobody wrote.
 *
 * An over-long list is the one thing TRUNCATED rather than discarded. It is not corrupt, it is stale,
 * and cutting it reuses the same bound a live `record` applies.
 */
function parse(raw: string | null): readonly CodexModelTarget[] {
  if (raw === null) return [];
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  const kept: CodexModelTarget[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = asJsonObject(item);
    if (row === undefined) return [];
    const model = asJsonString(row.model);
    const effortText = asJsonString(row.effort);
    if (model === undefined || !validModel(model)) return [];
    if (effortText === undefined || !validEffort(effortText)) return [];
    const key = `${model} ${effortText}`;
    if (seen.has(key)) return [];
    seen.add(key);
    kept.push({ model, effort: effortText });
  }
  return freezeRecents(kept.slice(0, CODEX_MODEL_RECENTS_MAX));
}

function sameRecents(a: readonly CodexModelTarget[], b: readonly CodexModelTarget[]): boolean {
  return a.length === b.length && a.every((entry, index) => samePair(entry, b[index]!));
}

function setRecents(next: readonly CodexModelTarget[], persist = true): void {
  if (sameRecents(recents, next)) return;
  recents = next;
  if (persist) write(next);
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== CODEX_MODEL_RECENTS_STORAGE_KEY) return;
  // A removed key is another tab clearing the history, or a fresh installation; either way this tab
  // follows it to empty rather than holding a list the storage no longer has.
  // Storage events are already the persisted value from another document. Writing it back here
  // would bounce the same event between tabs indefinitely.
  setRecents(parse(event.newValue), false);
}

globalThis.addEventListener?.("storage", onStorage);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The array itself is the snapshot: frozen, and replaced only when it actually changes. */
function getSnapshot(): readonly CodexModelTarget[] {
  return recents;
}

/**
 * Move a pair to the front, or add it there.
 *
 * A pair already AT THE FRONT is a no-op that touches nothing — no state, no notify, no write. That
 * guard is load-bearing rather than tidy: the caller records on every verified send, and a redundant
 * write per send is a `localStorage` write per send.
 */
export function recordRecent(model: string, effort: CodexReasoningEffort): void {
  if (!validModel(model) || !validEffort(effort)) return;
  const head = recents[0];
  if (head !== undefined && head.model === model && head.effort === effort) return;
  const pair = { model, effort };
  const rest = recents.filter((entry) => !samePair(entry, pair));
  setRecents(freezeRecents([pair, ...rest].slice(0, CODEX_MODEL_RECENTS_MAX)));
}

export function removeRecent(model: string, effort: CodexReasoningEffort): void {
  const pair = { model, effort };
  const next = recents.filter((entry) => !samePair(entry, pair));
  // Pairs are unique, so a shorter list is the only way this removed anything.
  if (next.length === recents.length) return;
  setRecents(freezeRecents(next));
}

export function clearRecents(): void {
  if (recents.length === 0) return;
  setRecents(freezeRecents([]));
}

export interface UseCodexModelRecentsReturn {
  recents: readonly CodexModelTarget[];
  record: (model: string, effort: CodexReasoningEffort) => void;
  remove: (model: string, effort: CodexReasoningEffort) => void;
  clear: () => void;
}

export function useCodexModelRecents(): UseCodexModelRecentsReturn {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    recents: snapshot,
    record: recordRecent,
    remove: removeRecent,
    clear: clearRecents,
  };
}

/** Test seam for the module-scoped store. */
export function __resetCodexModelRecents(): void {
  recents = freezeRecents([]);
  try {
    storage()?.removeItem(CODEX_MODEL_RECENTS_STORAGE_KEY);
  } catch {
    // Ignore test-environment/private-mode storage failures.
  }
  for (const listener of listeners) listener();
}
