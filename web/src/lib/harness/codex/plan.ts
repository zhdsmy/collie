// Codex's completed proposed plan and its implementation picker. Only the complete, known menu
// earns native controls; a long body's visible tail is retained without guessing hard wraps.
import { lineText, type StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, rstrip } from "./markers";

const TITLE = "Implement this plan?";
const FOOTER = "Press enter to confirm or esc to go back";
const RECAP = /^─+ Conversation recap ─+$/;
const OPTION = /^(› | {2})([1-3])\. (.+)$/;
const LABELS = ["Yes, implement this plan", "Yes, clear context and implement", "No, stay in Plan mode"];
const DESCRIPTIONS = [
  /^Switch to Default and start coding\.$/,
  /^Fresh thread(?: with this plan)?\.(?: Context: (?:\d{1,3}%|\d+(?:\.\d+)?[KM]?) used\.)?$/,
  /^Continue planning with the model\.$/,
];

function ink(line: StyledLine) {
  return line.segments.filter((segment) => segment.text.trim());
}

export function detectPlanRegion(lines: StyledLine[]): { startLine: number; model: PickerModel } | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0 || texts[tail]!.trim() !== FOOTER || !ink(lines[tail]!).every((segment) => segment.dim)) return null;
  let title = tail - 1;
  while (title >= Math.max(0, tail - 40) && texts[title]!.trim() !== TITLE) title--;
  if (title < Math.max(0, tail - 40) || !ink(lines[title]!).every((segment) => segment.bold)) return null;

  const rows: { id: string; text: string; pointed: boolean }[] = [];
  for (let row = title + 1; row < tail; row++) {
    const text = texts[row]!;
    if (!text.trim()) continue;
    const option = OPTION.exec(text);
    if (option) {
      if (Number(option[2]) !== rows.length + 1) return null;
      const pointed = option[1] === "› ";
      if (pointed && !ink(lines[row]!).every((segment) => segment.bold && segment.fg === "var(--ansi-6)")) return null;
      rows.push({ id: option[2]!, text: option[3]!, pointed });
    } else {
      const previous = rows.at(-1);
      if (!previous || !/^\s+\S/.test(text)) return null;
      previous.text += ` ${text.trim()}`;
    }
  }
  if (rows.length !== 3 || rows.filter((row) => row.pointed).length !== 1) return null;
  const options: PickerOption[] = [];
  for (const [index, row] of rows.entries()) {
    const copy = row.text.replace(/\s+/g, " ").trim();
    const label = LABELS[index]!;
    if (!copy.startsWith(`${label} `)) return null;
    const description = copy.slice(label.length + 1);
    if (!DESCRIPTIONS[index]!.test(description)) return null;
    options.push({ id: row.id, label, description, pointed: row.pointed, checked: false, current: false, orderable: false });
  }

  let separator = title - 1;
  while (separator >= 0 && !texts[separator]!.trim()) separator--;
  if (separator < 0) return null;
  let recap: string | undefined;
  // On resume, Codex inserts a recap between the painted plan and its native menu.
  // Only cross that exact, styled heading; arbitrary unpainted output is not a plan.
  if (!ink(lines[separator]!)[0]?.bg) {
    let heading = separator;
    while (heading >= 0 && !RECAP.test(texts[heading]!.trim()) && !ink(lines[heading]!)[0]?.bg) heading--;
    if (heading >= 0 && RECAP.test(texts[heading]!.trim())) {
      const segments = ink(lines[heading]!);
      if (!segments.some((segment) => segment.bold && segment.text.trim() === "Conversation recap") ||
        !segments.every((segment) => segment.text.trim() === "Conversation recap" ? segment.bold : segment.dim)) return null;
      recap = texts.slice(heading + 1, separator + 1).join("\n").trim();
      if (!recap) return null;
      separator = heading - 1;
      while (separator >= 0 && !texts[separator]!.trim()) separator--;
      if (separator >= 0 && /^─+$/.test(texts[separator]!.trim()) && ink(lines[separator]!).every((segment) => segment.dim)) separator--;
      while (separator >= 0 && !texts[separator]!.trim()) separator--;
      if (separator < 0) return null;
    }
  }
  // Codex omits Worked for on fast turns. Both captured layouts keep the painted plan body
  // immediately above the menu (with only this optional completion rule between them).
  let end = /^─+ Worked for .+ ─+$/.test(texts[separator]!.trim()) ? separator - 1 : separator;
  while (end >= 0 && !texts[end]!.trim()) end--;
  if (end < 0) return null;
  const background = ink(lines[end]!)[0]?.bg;
  if (!background) return null;
  let start = end;
  while (start > 0 && (!texts[start - 1]!.trim() || ink(lines[start - 1]!)[0]?.bg === background)) start--;
  const complete = start > 0 && texts[start - 1]!.trim() === "• Proposed Plan" &&
    ink(lines[start - 1]!).some((segment) => segment.bold);
  const body = texts.slice(start, end + 1).map((text) => text.replace(/^ {2}/, "")).join("\n").trim();
  if (!body) return null;
  const regionStart = complete ? start - 1 : start;
  const region = texts.slice(regionStart, tail + 1).join("\n");
  return {
    startLine: regionStart,
    model: {
      kind: "single", identity: `plan:${recap ? JSON.stringify([body, recap]) : body}`, title: TITLE, description: [], options,
      query: null, preview: [], footer: FOOTER, signature: region, regionSignature: region,
      plan: { text: body, complete, recap },
    },
  };
}
