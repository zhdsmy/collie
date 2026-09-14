import { useSyncExternalStore } from "react";

import { asJsonObject, asJsonString, parseJson } from "@/lib/json";
import {
  CODEX_REASONING_EFFORTS,
  type CodexModelTarget,
  type CodexReasoningEffort,
} from "@/lib/harness/codex/model-field";

/** How many pairs each Codex session remembers. Older ones fall off the end. */
export const CODEX_MODEL_RECENTS_MAX = 8;

/** Retained for migration visibility; v2 deliberately never reads this global list. */
export const CODEX_MODEL_RECENTS_STORAGE_KEY = "collie:codex-model-recents:v1";
export const CODEX_MODEL_RECENTS_STORAGE_PREFIX = "collie:codex-model-recents:v2:";

const EMPTY_RECENTS: readonly CodexModelTarget[] = Object.freeze([]);
const stores = new Map<string, readonly CodexModelTarget[]>();
const listeners = new Map<string, Set<() => void>>();

export function codexModelRecentsStorageKey(codexSessionKey: string): string {
  return `${CODEX_MODEL_RECENTS_STORAGE_PREFIX}${codexSessionKey}`;
}

function freezeRecents(next: readonly CodexModelTarget[]): readonly CodexModelTarget[] {
  return Object.freeze(next.map((entry) => Object.freeze({ ...entry })));
}

function samePair(a: CodexModelTarget, b: CodexModelTarget): boolean {
  return a.model === b.model && a.effort === b.effort;
}

function validSessionKey(key: string | undefined): key is string {
  return key !== undefined && key.length > 0 && key.length <= 128 && !/[\p{C}\s]/u.test(key);
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

function readStored(codexSessionKey: string): string | null {
  try {
    return storage()?.getItem(codexModelRecentsStorageKey(codexSessionKey)) ?? null;
  } catch {
    return null;
  }
}

function write(codexSessionKey: string, next: readonly CodexModelTarget[]): void {
  try {
    storage()?.setItem(codexModelRecentsStorageKey(codexSessionKey), JSON.stringify(next));
  } catch {
    // Private mode, a quota, or no storage: the current page still keeps its list in memory.
  }
}

/** Parse one session's entry without salvaging partially corrupt rows. */
function parse(raw: string | null): readonly CodexModelTarget[] {
  if (raw === null) return EMPTY_RECENTS;
  const value = parseJson(raw);
  if (!Array.isArray(value)) return EMPTY_RECENTS;
  const kept: CodexModelTarget[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const row = asJsonObject(item);
    if (row === undefined) return EMPTY_RECENTS;
    const model = asJsonString(row.model);
    const effort = asJsonString(row.effort);
    if (model === undefined || !validModel(model) || effort === undefined || !validEffort(effort)) {
      return EMPTY_RECENTS;
    }
    const pair = { model, effort };
    const key = `${model} ${effort}`;
    if (seen.has(key)) return EMPTY_RECENTS;
    seen.add(key);
    kept.push(pair);
  }
  return freezeRecents(kept.slice(0, CODEX_MODEL_RECENTS_MAX));
}

function ensureLoaded(codexSessionKey: string): readonly CodexModelTarget[] {
  const current = stores.get(codexSessionKey);
  if (current !== undefined) return current;
  const loaded = parse(readStored(codexSessionKey));
  stores.set(codexSessionKey, loaded);
  return loaded;
}

function sameRecents(a: readonly CodexModelTarget[], b: readonly CodexModelTarget[]): boolean {
  return a.length === b.length && a.every((entry, index) => samePair(entry, b[index]!));
}

function notify(codexSessionKey: string): void {
  for (const listener of listeners.get(codexSessionKey) ?? []) listener();
}

function setRecents(
  codexSessionKey: string | undefined,
  next: readonly CodexModelTarget[],
  persist = true,
): void {
  if (!validSessionKey(codexSessionKey)) return;
  const current = ensureLoaded(codexSessionKey);
  if (sameRecents(current, next)) return;
  stores.set(codexSessionKey, next);
  if (persist) write(codexSessionKey, next);
  notify(codexSessionKey);
}

function onStorage(event: StorageEvent): void {
  if (event.key === null) {
    for (const key of stores.keys()) setRecents(key, EMPTY_RECENTS, false);
    return;
  }
  if (!event.key.startsWith(CODEX_MODEL_RECENTS_STORAGE_PREFIX)) return;
  const key = event.key.slice(CODEX_MODEL_RECENTS_STORAGE_PREFIX.length);
  // Do not let arbitrary storage events grow this map. A later hook mount reads the current value.
  if (!validSessionKey(key) || !stores.has(key)) return;
  setRecents(key, parse(event.newValue), false);
}

globalThis.addEventListener?.("storage", onStorage);

function subscribe(codexSessionKey: string | undefined, listener: () => void): () => void {
  if (!validSessionKey(codexSessionKey)) return () => undefined;
  const keyListeners = listeners.get(codexSessionKey) ?? new Set<() => void>();
  keyListeners.add(listener);
  listeners.set(codexSessionKey, keyListeners);
  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(codexSessionKey);
  };
}

function getSnapshot(codexSessionKey: string | undefined): readonly CodexModelTarget[] {
  return validSessionKey(codexSessionKey) ? ensureLoaded(codexSessionKey) : EMPTY_RECENTS;
}

export function recordRecent(
  codexSessionKey: string | undefined,
  model: string,
  effort: CodexReasoningEffort,
): void {
  if (!validSessionKey(codexSessionKey) || !validModel(model) || !validEffort(effort)) return;
  const current = ensureLoaded(codexSessionKey);
  const head = current[0];
  if (head !== undefined && head.model === model && head.effort === effort) return;
  const pair = { model, effort };
  const rest = current.filter((entry) => !samePair(entry, pair));
  setRecents(codexSessionKey, freezeRecents([pair, ...rest].slice(0, CODEX_MODEL_RECENTS_MAX)));
}

export function removeRecent(
  codexSessionKey: string | undefined,
  model: string,
  effort: CodexReasoningEffort,
): void {
  if (!validSessionKey(codexSessionKey)) return;
  const current = ensureLoaded(codexSessionKey);
  const pair = { model, effort };
  const next = current.filter((entry) => !samePair(entry, pair));
  if (next.length === current.length) return;
  setRecents(codexSessionKey, freezeRecents(next));
}

export function clearRecents(codexSessionKey: string | undefined): void {
  if (!validSessionKey(codexSessionKey)) return;
  if (ensureLoaded(codexSessionKey).length === 0) return;
  setRecents(codexSessionKey, EMPTY_RECENTS);
}

export interface UseCodexModelRecentsReturn {
  recents: readonly CodexModelTarget[];
  record: (model: string, effort: CodexReasoningEffort) => void;
  remove: (model: string, effort: CodexReasoningEffort) => void;
  clear: () => void;
}

export function useCodexModelRecents(codexSessionKey: string | undefined): UseCodexModelRecentsReturn {
  const snapshot = useSyncExternalStore(
    (listener) => subscribe(codexSessionKey, listener),
    () => getSnapshot(codexSessionKey),
    () => EMPTY_RECENTS,
  );
  return {
    recents: snapshot,
    record: (model, effort) => recordRecent(codexSessionKey, model, effort),
    remove: (model, effort) => removeRecent(codexSessionKey, model, effort),
    clear: () => clearRecents(codexSessionKey),
  };
}

/** Test seam; only clears session keys loaded by this module, never the legacy v1 entry. */
export function __resetCodexModelRecents(): void {
  const keys = new Set([...stores.keys(), ...listeners.keys()]);
  try {
    const store = storage();
    for (const key of keys) store?.removeItem(codexModelRecentsStorageKey(key));
  } catch {
    // Ignore test-environment/private-mode storage failures.
  }
  stores.clear();
  for (const key of keys) notify(key);
}
