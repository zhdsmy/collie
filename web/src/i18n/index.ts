import { useCallback, useSyncExternalStore } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";
import type { AgentStatus } from "@/lib/types";

export type AppLanguage = "en" | "zh-CN" | "zh-TW";
export type LanguagePreference = "system" | AppLanguage;

export interface LanguageState {
  /** The device-local choice shown in Settings. */
  preference: LanguagePreference;
  /** The BCP 47 locale currently applied to i18next and the document. */
  resolved: AppLanguage;
}

const STORAGE_KEY = "collie:language:v1";
const DEFAULT: LanguagePreference = "system";

function isPreference(value: string | null): value is LanguagePreference {
  return value === "system" || value === "en" || value === "zh-CN" || value === "zh-TW";
}

function loadPreference(): LanguagePreference {
  try {
    const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function savePreference(preference: LanguagePreference): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private mode or a full quota must not stop the in-memory choice from applying.
  }
}

/** Map the browser's language priority list onto Collie's supported BCP 47 locales. */
export function resolveSystemLanguage(
  languages: readonly string[] = typeof navigator === "undefined"
    ? []
    : (navigator.languages ?? [navigator.language]),
): AppLanguage {
  for (const language of languages) {
    const tag = language.toLowerCase();
    if (tag.startsWith("zh")) {
      if (/(?:^|-)hant(?:-|$)/.test(tag) || /(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(tag)) {
        return "zh-TW";
      }
      return "zh-CN";
    }
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "en";
}

function resolvePreference(preference: LanguagePreference): AppLanguage {
  return preference === "system" ? resolveSystemLanguage() : preference;
}

let state: LanguageState = {
  preference: loadPreference(),
  resolved: "en",
};
state = { ...state, resolved: resolvePreference(state.preference) };

void i18n.use(initReactI18next).init({
  resources,
  lng: state.resolved,
  fallbackLng: "en",
  supportedLngs: ["en", "zh-CN", "zh-TW"],
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  returnNull: false,
});

function apply(resolved: AppLanguage): void {
  void i18n.changeLanguage(resolved);
  if (typeof document === "undefined") return;
  document.documentElement.lang = resolved;
  document.documentElement.dir = i18n.dir(resolved);
}

const listeners = new Set<() => void>();
apply(state.resolved);

function refresh(preference: LanguagePreference): void {
  const resolved = resolvePreference(preference);
  if (state.preference === preference && state.resolved === resolved) return;
  state = { preference, resolved };
  apply(resolved);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): LanguageState {
  return state;
}

/** Non-hook access for protocol payloads such as Web Push registration. */
export function getResolvedLanguage(): AppLanguage {
  return state.resolved;
}

if (typeof window !== "undefined") {
  window.addEventListener("languagechange", () => {
    if (state.preference === "system") refresh("system");
  });
}

export interface UseLanguageReturn extends LanguageState {
  setLanguage: (preference: LanguagePreference) => void;
}

export function setLanguagePreference(preference: LanguagePreference): void {
  savePreference(preference);
  refresh(preference);
}

export function useLanguage(): UseLanguageReturn {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setLanguage = useCallback(setLanguagePreference, []);
  return { ...snapshot, setLanguage };
}

const STATUS_KEYS = {
  blocked: "status.blocked",
  working: "status.working",
  done: "status.done",
  idle: "status.idle",
  unknown: "status.unknown",
} as const satisfies Record<AgentStatus, string>;

/** Typed translation key for a bridge-provided agent status. */
export function statusKey(status: AgentStatus): (typeof STATUS_KEYS)[AgentStatus] {
  return STATUS_KEYS[status];
}

export { i18n };
