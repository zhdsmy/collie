import type { StyledLine } from "../blocks";

/** A visible row, never an inferred entry from outside the terminal viewport. */
export interface PickerOption {
  id: string;
  label: string;
  description: string;
  pointed: boolean;
  current: boolean;
  checked: boolean;
  orderable: boolean;
}

/** A parsed terminal picker. The terminal remains the source of every staged value. */
export interface PickerModel {
  kind: "single" | "multiple";
  /** Identifies this picker stage, including the model for an effort picker. */
  identity: string;
  title: string;
  description: string[];
  options: PickerOption[];
  /** null means this picker has no search input. */
  query: string | null;
  preview: StyledLine[];
  footer: string;
  signature: string;
  regionSignature: string;
  /** A question within one native questionnaire; the footer declares what Enter will do. */
  questionnaire?: {
    index: number;
    total: number;
    unanswered: number;
    answered: boolean;
    submit: "answer" | "all";
  };
}

/** Maximum query length accepted from a native search control. */
export const PICKER_SEARCH_MAX_LENGTH = 256;

/**
 * Keep picker search input printable and prevent Space from becoming a toggle key. The UI and
 * action layer share this pure normalization so a local draft cannot disagree with Codex's query.
 */
export function sanitizePickerSearchQuery(
  query: string,
  maxLength = PICKER_SEARCH_MAX_LENGTH,
): string {
  const limit = Math.max(0, Math.floor(maxLength));
  return query
    .replace(/\p{Cc}/gu, "")
    .replace(/\s+/gu, "")
    .slice(0, limit);
}

export type PickerIntent =
  | { kind: "choose"; id: string }
  | { kind: "focus"; id: string }
  | { kind: "question"; direction: "previous" | "next" }
  | { kind: "toggle"; id: string }
  | { kind: "move"; id: string; direction: "up" | "down" }
  | { kind: "navigate"; direction: "up" | "down" }
  | { kind: "search"; query: string }
  | { kind: "confirm" }
  | { kind: "cancel" };

export function pickersEqual(a: PickerModel, b: PickerModel): boolean {
  return pickersSameIdentity(a, b) && a.signature === b.signature &&
    a.questionnaire?.unanswered === b.questionnaire?.unanswered &&
    a.questionnaire?.answered === b.questionnaire?.answered &&
    a.questionnaire?.submit === b.questionnaire?.submit;
}

export function pickersSameIdentity(a: PickerModel, b: PickerModel): boolean {
  return a.kind === b.kind && a.identity === b.identity &&
    a.questionnaire?.index === b.questionnaire?.index &&
    a.questionnaire?.total === b.questionnaire?.total;
}
