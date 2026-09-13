import { fold, PROBE_CHARS, replyProse } from "./latest-reply";
import type { PickerModel } from "./harness/picker-model";
import type { TranscriptEntry } from "./types";
import { parseMarkdown, type MdSpan } from "./markdown";

function spanText(spans: MdSpan[]): string {
  return spans.map((span) => "text" in span ? span.text : spanText(span.spans)).join("");
}

/** Markdown syntax (notably a fenced code block's language) is absent from Codex's display. */
function renderedText(source: string): string {
  return parseMarkdown(source).map((block) => {
    switch (block.kind) {
      case "code": return block.text;
      case "rule": return "";
      case "list": return block.items.map((item, index) => `${block.ordered ? index + 1 : ""} ${spanText(item)}`).join("\n");
      case "table": return [block.header, ...block.rows].map((row) => row.map(spanText).join(" ")).join("\n");
      default: return spanText(block.spans);
    }
  }).join("\n");
}

/** Read-only enhancement: require an explicit proposed plan whose entire visible tail matches.
 * Never use an older, truncated or merely similar journal turn as the plan being approved. */
export function completePlanText(plan: NonNullable<PickerModel["plan"]>, entry: TranscriptEntry | null): string | null {
  if (!entry || entry.role !== "assistant" || entry.parts.some((part) => part.kind === "text" && part.truncated)) return null;
  const source = replyProse(entry);
  const match = /^\s*<proposed_plan>\s*([\s\S]*?)\s*<\/proposed_plan>\s*$/.exec(source);
  if (!match) return null;
  const original = match[1]!.trim();
  if (/<\/?proposed_plan>/.test(original)) return null;
  const candidates = [fold(original), fold(renderedText(original))];
  const visible = fold(plan.text);
  if (!visible || !candidates.some((normalized) => plan.complete ? normalized === visible :
    visible.length >= PROBE_CHARS && normalized.endsWith(visible))) return null;
  return original;
}
