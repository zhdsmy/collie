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
  /** Presentation of a saved-session chooser; native labels and action guards stay untouched. */
  sessionAction?: "resume" | "fork";
  /** Visible plan body, kept exact; a verified journal match may supply its complete source. */
  plan?: { text: string; complete: boolean };
  /** A question within one native questionnaire; the footer declares what Enter will do. */
  questionnaire?: {
    index: number;
    total: number;
    unanswered: number;
    answered: boolean;
    submit: "answer" | "all";
    /** Async questions are individually delivered, then removed from the pending queue. */
    async?: { collapsed: boolean; otherId: string | null };
    /** Native note composer, including stored notes when option focus is restored. */
    notes?: { text: string; focused: boolean };
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
  | { kind: "expand" }
  | { kind: "choose"; id: string }
  | { kind: "focus"; id: string }
  | { kind: "question"; direction: "previous" | "next" }
  | { kind: "answer"; notes: string }
  | { kind: "toggle"; id: string }
  | { kind: "move"; id: string; direction: "up" | "down" }
  | { kind: "navigate"; direction: "up" | "down" }
  | { kind: "search"; query: string }
  | { kind: "confirm" }
  | { kind: "cancel" };

export function pickersEqual(a: PickerModel, b: PickerModel): boolean {
  return pickersSameIdentity(a, b) && a.signature === b.signature &&
    a.plan?.text === b.plan?.text && a.plan?.complete === b.plan?.complete &&
    a.questionnaire?.unanswered === b.questionnaire?.unanswered &&
    a.questionnaire?.answered === b.questionnaire?.answered &&
    a.questionnaire?.submit === b.questionnaire?.submit &&
    a.questionnaire?.notes?.text === b.questionnaire?.notes?.text &&
    a.questionnaire?.notes?.focused === b.questionnaire?.notes?.focused;
}

export function pickersSameIdentity(a: PickerModel, b: PickerModel): boolean {
  return a.kind === b.kind && a.identity === b.identity &&
    a.sessionAction === b.sessionAction &&
    a.questionnaire?.async?.collapsed === b.questionnaire?.async?.collapsed &&
    a.questionnaire?.async?.otherId === b.questionnaire?.async?.otherId &&
    a.plan?.text === b.plan?.text && a.plan?.complete === b.plan?.complete &&
    a.questionnaire?.index === b.questionnaire?.index &&
    a.questionnaire?.total === b.questionnaire?.total;
}
