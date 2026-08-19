import { useCallback, useSyncExternalStore } from "react";

// Global monospace preference. The selected face drives Tailwind's `font-mono` utility through the
// root data attribute and CSS variables in index.css, so terminal output and compact command text
// stay in sync without threading a font prop through the component tree.

export type TerminalFont = "system-mono" | "geist-mono" | "jetbrains-mono";

const STORAGE_KEY = "collie:terminal-font:v1";
const DEFAULT: TerminalFont = "system-mono";

function isTerminalFont(value: string | null): value is TerminalFont {
  return value === "system-mono" || value === "geist-mono" || value === "jetbrains-mono";
}

function loadFont(): TerminalFont {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return isTerminalFont(stored) ? stored : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function saveFont(font: TerminalFont): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, font);
  } catch {
    // Private mode or a full quota should not stop the in-memory choice from applying.
  }
}

function applyFont(font: TerminalFont): void {
  if (typeof document !== "undefined") document.documentElement.dataset.terminalFont = font;
}

let current = loadFont();
const listeners = new Set<() => void>();
applyFont(current);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TerminalFont {
  return current;
}

function update(font: TerminalFont): void {
  if (font === current) return;
  current = font;
  saveFont(font);
  applyFont(font);
  for (const listener of listeners) listener();
}

export interface UseTerminalFontReturn {
  font: TerminalFont;
  setFont: (font: TerminalFont) => void;
}

export function useTerminalFont(): UseTerminalFontReturn {
  const font = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setFont = useCallback((next: TerminalFont) => update(next), []);
  return { font, setFont };
}
