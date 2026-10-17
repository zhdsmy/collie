import type { Frame } from "./frame";
import type { QueuedRow } from "./profile";

/** Native queue rows immediately above the input box, in submission order. */
export function queuedTexts(rows: readonly string[], frame: Frame | null, drawing: QueuedRow | undefined): string[] {
  if (frame === null || drawing === undefined) return [];
  const start = new RegExp(drawing.pattern, "u");
  const hint = new RegExp(drawing.hint, "u");
  const above = rows.slice(0, frame.top);
  for (let at = above.length - 1; at >= 0; at--) {
    if (!hint.test(above[at]!)) continue;
    let i = at - 1;
    for (let gap = 0; i >= 0 && gap < drawing.hintGap && above[i]!.trim().length === 0; gap++) i--;
    const messages: string[] = [];
    let wrapped: string[] = [];
    for (const floor = Math.max(0, i - 24); i >= floor; i--) {
      const row = above[i]!;
      const head = start.exec(row);
      if (head !== null) {
        messages.unshift([head.groups?.text ?? "", ...wrapped].join(" "));
        wrapped = [];
      } else if (/^\s+\S/u.test(row)) {
        wrapped.unshift(row.trim());
      } else break;
    }
    return messages;
  }
  return [];
}
