import { lineText, type StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { isHorizontalRule } from "./markers";

const GROUPS = ["Ready for review", "Needs input", "Working", "Completed"];
const NOTICE = "Your conversation moved to the background — enter opens it · esc returns to it · ctrl+c twice quits";
const HINTS = new Set(["enter to return", "enter to open", "space to reply", "ctrl+x to delete", "ctrl+x to stop", "ctrl+x to delete all", "? for shortcuts"]);

/** The left-arrow launcher owns group headings as well as session rows; both count in an arrow walk. */
export function detectAgentsRegion(lines: StyledLine[]): { startLine: number; model: PickerModel } | null {
  const texts = lines.map(lineText);
  let end = texts.length - 1;
  while (end >= 0 && !texts[end]!.trim()) end--;
  let bottom = end - 1;
  while (bottom >= 0 && end - bottom <= 3 && !isHorizontalRule(texts[bottom]!)) bottom--;
  if (bottom < 2 || end - bottom > 3 ||
    texts[bottom - 1]!.trim() !== "❯ describe a task for a new session" || !isHorizontalRule(texts[bottom - 2]!)) return null;
  const footer = texts.slice(bottom + 1, end + 1).map((row) => row.trim()).join(" ");
  const hints = footer.split(" · ");
  if (/^(?:⏵⏵|⏸) /.test(hints[0]!)) hints.shift();
  if (hints.at(-1) !== "? for shortcuts" || hints.some((hint) => !HINTS.has(hint))) return null;

  const start = texts.findLastIndex((text) => /\bClaude Code v\d+\.\d+\.\d+\b/.test(text));
  if (start < 0 || end - start > 200 || !lines[start]!.segments.some((s) => s.bold && s.text.includes("Claude Code"))) return null;
  const firstGroup = texts.findIndex((text, i) => i > start && GROUPS.includes(text.trim()));
  if (firstGroup < 0 || firstGroup >= bottom - 2) return null;
  const heading = texts.slice(start, firstGroup).map((row) => row.trim()).join(" ").replace(/\s+/g, " ");
  const summary = /\b\d+ awaiting input · \d+ working · \d+ completed\b/.exec(heading)?.[0];
  if (!summary || !heading.includes(NOTICE)) return null;

  const options: PickerOption[] = [];
  const order: string[] = [];
  const groups: string[] = [];
  const selectedGroups: string[] = [];
  let group = "";
  for (let i = firstGroup; i < bottom - 2; i++) {
    const text = texts[i]!.trim();
    const segments = lines[i]!.segments;
    if (GROUPS.includes(text)) {
      if (groups.includes(text) || GROUPS.indexOf(text) < GROUPS.indexOf(group)) return null;
      group = text;
      groups.push(group);
      const id = `group:${group}`;
      order.push(id);
      if (segments.some((s) => s.bold)) selectedGroups.push(id);
      continue;
    }
    if (!text) continue;
    // At 40 columns Claude wraps the Working group's explanatory sentence onto a dash-led row.
    if (group === "Working" && /^\s+—\s/.test(texts[i]!)) continue;
    if (!/^ ?[^\p{L}\p{N}\s] /u.test(texts[i]!)) {
      if (!/^\s/.test(texts[i]!)) return null;
      continue;
    }
    const row = /^ ?\S (.+?)\s{2,}(.*?)\s{2,}(?:now|\d+[smhd])$/u.exec(texts[i]!);
    if (!row) return null;
    const label = row[1]!.trim();
    const description = row[2]!.trim();
    // Claude truncates titles; native arrow positions distinguish repeated visible names.
    const id = `session:${options.length}`;
    const pointed = segments.some((s) => s.bg !== undefined && s.text.trim() !== "");
    const current = segments.some((s) => s.bold && s.text.trim() === label);
    options.push({ id, label, description: `${group}${description ? ` · ${description}` : ""}`,
      pointed, current, checked: false, orderable: false });
    order.push(id);
  }
  const pointed = options.filter((option) => option.pointed);
  if (pointed.length > 1 || selectedGroups.length > 1 || (pointed.length === 0 && selectedGroups.length !== 1)) return null;
  const id = pointed[0]?.id ?? selectedGroups[0]!;
  if (pointed.length === 1 && !hints.some((hint) => /^enter to (?:return|open)$/.test(hint))) return null;
  if (pointed.length === 0 && hints.some((hint) => hint.startsWith("enter to "))) return null;
  const navigation = { order, id };
  const identity = `agents:claude:${texts.slice(start, firstGroup).join("\n")}`;
  return { startLine: start, model: {
    kind: "single", identity, title: "Agents", description: [summary], options, query: null, preview: [],
    footer: NOTICE, navigation,
    // Timers and spinner paint change without changing a session or its keyboard position.
    signature: JSON.stringify({ identity, options, navigation, footer }),
    regionSignature: texts.slice(start, end + 1).join("\n"),
  } };
}
