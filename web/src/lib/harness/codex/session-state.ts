import { lineText, type StyledLine } from "../../blocks";

export type CodexActivity = "ready" | "working";

/** Live session fields Collie can prove from Codex's own status line. Missing means unknown. */
export interface CodexSessionState {
  model?: string;
  activity?: CodexActivity;
  approval?: string;
  fast?: boolean;
}

const MODEL = /\b(gpt-[a-z0-9][a-z0-9.-]*)\b/i;
const APPROVAL = /^(Approve(?: for)? me|Approve|Read Only|Auto|Full Access)$/i;
const FAST = /^Fast(?::|\s+)(on|off)$/i;

/** Parse only complete dot-separated status items; ordinary transcript prose must not become state. */
export function parseCodexSessionState(lines: StyledLine[]): CodexSessionState | null {
  const fields = lines.flatMap((line) =>
    lineText(line)
      .trim()
      .split(/\s+·\s+/)
      .map((field) => field.trim())
      .filter(Boolean),
  );
  const state: CodexSessionState = {};

  for (const field of fields) {
    const model = MODEL.exec(field);
    if (state.model === undefined && model) state.model = model[1]!;

    if (/^Ready$/i.test(field)) state.activity = "ready";
    else if (/^Working$/i.test(field)) state.activity = "working";

    const fast = FAST.exec(field);
    if (fast) state.fast = fast[1]!.toLowerCase() === "on";

    if (state.approval === undefined && APPROVAL.test(field)) state.approval = field;
  }

  return Object.keys(state).length === 0 ? null : state;
}
