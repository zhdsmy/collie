import { lineText, type StyledLine } from "../../blocks";
import type { MenuModel } from "../menu-model";
import { regionSignature } from "./prompt-select";

const KEYBOARD = /^Keyboard: ↑\/↓ Navigate(?: ←\/→ Effort)? enter Select(?: esc Go Back)?$/i;
const STATUS = /^(?:\s{8,}\S.* · \S+|\S+\s+(?:idle|reviewing|error|working|thinking|authenticating|merging|waiting|done)\s+\S.*|\S+(?: \S+)*\s{2,}(?:auto|default|accept-edits|plan|fast|custom)\s{2,}(?:idle|reviewing|error|working|thinking|tool_use|initializing|authenticating|merging|waiting|done)(?:\s{2,}\S.*)?)$/;

/** The native model menu, including footer keys clipped at narrow terminal widths. */
export function detectModelRegion(lines: StyledLine[]): { model: MenuModel; startLine: number } | null {
  const texts = lines.map(lineText);
  let end = texts.length - 1;
  while (end >= 0 && texts[end]!.trim() === "") end--;
  let keyboard = end;
  while (keyboard >= 0 && end - keyboard < 8 && !/^Keyboard:\s/.test(texts[keyboard]!)) keyboard--;
  if (keyboard < 0 || !/^Keyboard:\s/.test(texts[keyboard]!)) return null;

  let footerEnd = keyboard;
  if (/^\s*esc Go Back\s*$/i.test(texts[keyboard + 1] ?? "")) footerEnd++;
  const footer = texts.slice(keyboard, footerEnd + 1).join(" ").replace(/\s+/g, " ").trim();
  if (!KEYBOARD.test(footer)) return null;
  const tail = texts.slice(footerEnd + 1, end + 1).filter((row) => row.trim() !== "");
  if (tail.length > 2 || tail.some((row) => !STATUS.test(row))) return null;

  let top = keyboard - 1;
  while (top >= 0 && keyboard - top < 60 && texts[top]!.trim() !== "Switch Model") top--;
  if (top < 0 || texts[top]!.trim() !== "Switch Model") return null;
  const body = texts.slice(top + 1, keyboard);
  if (!body.some((row) => /^\s*Search:/.test(row)) || body.filter((row) => /^> \S/.test(row)).length !== 1) return null;
  if (body.some((row) => /\b(?:press|hit)\s+\S+\s+to\b|\[y\/n\]|\(y\/n\)|\?\s*$/i.test(row))) return null;

  const nav: MenuModel["nav"] = { upDown: true };
  const effort = body.findIndex((row) => /^\s*Effort\s/.test(row));
  if (effort >= 0 && footer.includes("←/→ Effort")) {
    for (const line of lines.slice(top + effort + 2, keyboard)) {
      const labels = line.segments.filter((segment) => segment.bold && segment.text.trim() !== "");
      if (labels.length === 1) {
        nav.leftRight = { verb: "Effort", label: labels[0]!.text.trim() };
        break;
      }
    }
  }
  const actions: MenuModel["actions"] = [{ label: "Select", keys: ["Enter"] }];
  if (/esc Go Back/i.test(footer)) actions.push({ label: "Go back", keys: ["Escape"], cancel: true });
  return {
    startLine: top,
    model: { title: "Switch Model", nav, actions, signature: regionSignature(texts, top, end) },
  };
}
