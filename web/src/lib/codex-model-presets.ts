import { useCallback, useSyncExternalStore } from "react";

import { asJsonObject, asJsonString, parseJson } from "@/lib/json";

export type CodexReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
  | "ultra";

export const CODEX_REASONING_EFFORTS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const satisfies readonly CodexReasoningEffort[];

export interface CodexModelPreset {
  id: string;
  model: string;
  effort: CodexReasoningEffort;
}

export const CODEX_MODEL_PRESETS_STORAGE_KEY = "collie:codex-model-presets:v1";

const DEFAULT_PRESETS: readonly CodexModelPreset[] = [
  { id: "gpt-6-astra-xhigh", model: "gpt-6-astra", effort: "xhigh" },
  { id: "gpt-5.6-luna-max", model: "gpt-5.6-luna", effort: "max" },
];

type StoreError = "invalid" | "storage";

interface StoreState {
  presets: readonly CodexModelPreset[];
  error?: StoreError;
}

const listeners = new Set<() => void>();

function freezePresets(next: readonly CodexModelPreset[]): readonly CodexModelPreset[] {
  return Object.freeze(next.map((preset) => Object.freeze({ ...preset })));
}

function validModel(model: string): boolean {
  return model.length > 0 && !/[\p{C}\s]/u.test(model);
}

function validatePresets(next: readonly CodexModelPreset[]): boolean {
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const preset of next) {
    if (preset.id.length === 0 || ids.has(preset.id) || !validModel(preset.model)) {
      return false;
    }
    if (!CODEX_REASONING_EFFORTS.some((effort) => effort === preset.effort)) return false;
    const pair = `${preset.model}\u0000${preset.effort}`;
    if (pairs.has(pair)) return false;
    ids.add(preset.id);
    pairs.add(pair);
  }
  return true;
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
    return storage()?.getItem(CODEX_MODEL_PRESETS_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(next: readonly CodexModelPreset[]): boolean {
  try {
    const target = storage();
    if (target === null) return false;
    target.setItem(CODEX_MODEL_PRESETS_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function parse(raw: string | null): readonly CodexModelPreset[] | null {
  if (raw === null) return null;
  const value = parseJson(raw);
  if (!Array.isArray(value)) return null;
  const presets: CodexModelPreset[] = [];
  for (const item of value) {
    const row = asJsonObject(item);
    if (row === undefined) return null;
    const id = asJsonString(row.id);
    const model = asJsonString(row.model);
    const effortText = asJsonString(row.effort);
    const effort =
      effortText === undefined
        ? undefined
        : CODEX_REASONING_EFFORTS.find((candidate) => candidate === effortText);
    if (id === undefined || model === undefined || effort === undefined) return null;
    presets.push({ id, model, effort });
  }
  return validatePresets(presets) ? freezePresets(presets) : null;
}

function initialState(): StoreState {
  const persisted = parse(readStored());
  if (persisted !== null) return { presets: persisted };

  const presets = freezePresets(DEFAULT_PRESETS);
  // Defaults are written once. That makes a deliberate [] survive a reload instead of being
  // mistaken for a first visit, while a private-mode/quota failure still leaves this session usable.
  const persistedDefaults = write(presets);
  return { presets, error: persistedDefaults ? undefined : "storage" };
}

let state: StoreState = initialState();

function notify(): void {
  for (const listener of listeners) listener();
}

function setState(next: StoreState): void {
  state = next;
  notify();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== CODEX_MODEL_PRESETS_STORAGE_KEY) return;
  const parsed = parse(event.newValue);
  if (parsed !== null) {
    setState({ presets: parsed });
    return;
  }
  // A removed key is a new installation in the other tab; restore the one-time defaults locally.
  setState({ presets: freezePresets(DEFAULT_PRESETS) });
}

globalThis.addEventListener?.("storage", onStorage);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreState {
  return state;
}

function savePresets(next: readonly CodexModelPreset[]): boolean {
  if (!validatePresets(next)) {
    setState({ presets: state.presets, error: "invalid" });
    return false;
  }
  const presets = freezePresets(next);
  const persisted = write(presets);
  setState({ presets, error: persisted ? undefined : "storage" });
  return persisted;
}

export interface UseCodexModelPresetsReturn {
  presets: readonly CodexModelPreset[];
  save: (next: readonly CodexModelPreset[]) => boolean;
  error?: string;
}

export function useCodexModelPresets(): UseCodexModelPresetsReturn {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const save = useCallback((next: readonly CodexModelPreset[]) => savePresets(next), []);
  return { presets: snapshot.presets, save, error: snapshot.error };
}

/** Test seam for the module-scoped store. */
export function __resetCodexModelPresets(): void {
  state = { presets: freezePresets(DEFAULT_PRESETS) };
  try {
    storage()?.removeItem(CODEX_MODEL_PRESETS_STORAGE_KEY);
  } catch {
    // Ignore test-environment/private-mode storage failures.
  }
  notify();
}
