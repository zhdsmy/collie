// The daemon's Agent command center, opened by the empty composer's Left shortcut.
import { lineText, type StyledLine } from "../../blocks";
import type { PickerOption } from "../picker-model";
import { lastNonBlankIndex, rstrip } from "./markers";
import type { PickerRegion } from "./picker";

const TITLE = "Agent command center";
const HEADER = /^ {2}Agent command center {2,}Group: Project {2,}g$/;
const FILTERS = /^ {2,}All (\d+) +Needs you (\d+) +Working (\d+) +Ready (\d+) +Inactive (\d+) +tab\/shift\+tab +filter$/;
const FOOTER = "? help esc back ↑/↓ move enter open n new";
const ROW = /^( {2}› | {4})([○●!]) (\S(?:.*?\S)?) {2,}(?:(current) {2,})?(Needs input|Working|Ready|Inactive|Error) +(?:now|\d+[smhd] ago|\d{4}-\d{2}-\d{2}|-)$/;
const GROUP = /^ {2}(\S(?:.*\S)?) {2,}[1-9]\d*$/;

function left(text: string): string {
  return rstrip(text.split("│", 1)[0]!);
}

/** Only a complete list with the verified native navigation footer can own the keyboard. */
export function detectAgentsRegion(lines: StyledLine[]): PickerRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0 || texts[tail]!.trim().replace(/\s+/g, " ") !== FOOTER) return null;
  const keys = lines[tail]!.segments.filter((segment) => segment.bold).map((segment) => segment.text.trim());
  if (keys.join("|") !== "?|esc|↑/↓|enter|n") return null;

  const start = texts.findLastIndex((text) => HEADER.test(text));
  if (start < 0 || tail - start > 200 || texts.slice(0, start).some((text) => text.trim())) return null;
  if (lines[start]!.segments.find((segment) => segment.text.trim())?.bold !== true) return null;
  const filters = FILTERS.exec(texts[start + 1] ?? "");
  if (!filters || !/^ {2}─+$/.test(texts[start + 2] ?? "")) return null;
  if (!/^ {6}Tasks {2,}Status {2,}Updated$/.test(left(texts[start + 3] ?? ""))) return null;

  const options: PickerOption[] = [];
  let project = "";
  for (let index = start + 4; index < tail; index++) {
    const text = left(texts[index]!);
    if (!text.trim()) continue;
    const group = GROUP.exec(text);
    if (group) {
      if (lines[index]!.segments.find((segment) => segment.text.trim())?.dim !== true) return null;
      project = group[1]!;
      continue;
    }
    const row = ROW.exec(text);
    if (!row || !project) return null;
    const pointed = row[1] === "  › ";
    if (pointed && lines[index]!.segments.find((segment) => segment.text.includes("›"))?.bold !== true) return null;
    const status = row[5]!;
    if (row[2] !== (status === "Error" ? "!" : status === "Ready" || status === "Inactive" ? "○" : "●")) return null;
    const label = row[3]!;
    // The terminal exposes names rather than UUIDs. Ambiguous visible rows stay native.
    const id = `${project}\n${label}`;
    if (options.some((option) => option.id === id)) return null;
    options.push({ id, label, description: `${project} · ${status}`, pointed,
      current: row[4] === "current", checked: false, orderable: false });
  }
  if (options.filter((option) => option.pointed).length !== 1 || options.filter((option) => option.current).length > 1) return null;
  const region = texts.slice(start, tail + 1).join("\n");
  return {
    startLine: start,
    model: {
      kind: "single", identity: "agents:command-center", title: TITLE,
      description: [`All ${filters[1]} · Needs you ${filters[2]} · Working ${filters[3]} · Ready ${filters[4]} · Inactive ${filters[5]}`],
      options, query: null, preview: [], footer: texts[tail]!.trim(), signature: region, regionSignature: region,
    },
  };
}
