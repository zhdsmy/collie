// Codex MCP tool approvals use a single-field form, not request_user_input's notes protocol.
// Reuse the guarded picker arrows + Enter; never infer a digit shortcut from its numbering.
import type { StyledLine } from "../../blocks";
import type { PickerOption } from "../picker-model";
import type { PickerRegion } from "./picker";
import { lastNonBlankIndex, lineText, painted, pointedRow, regionSignature, rstrip } from "./markers";

const HEADER = /^ {2}Field 1\/1(?: \(1 required unanswered\))?$/;
const FOOTER = "enter to submit | esc to cancel";
const OPTION = /^(?: {2}› | {4})([1-4])\. (\S.*?) {2,}(\S.*)$/;
const CHOICES = [
  ["Allow", "Run the tool and continue"],
  ["Allow for this session", "Run the tool and remember this choice for this session"],
  ["Always allow", "Run the tool and remember this choice for future tool calls"],
  ["Cancel", "Cancel this tool call"],
] as const;

/** Only complete tool-approval forms; multi-field, text and ordinary MCP forms stay native. */
export function detectElicitationRegion(lines: StyledLine[]): PickerRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const end = lastNonBlankIndex(texts);
  if (end < 0 || texts[end]!.trim() !== FOOTER) return null;
  const keys = lines[end]!.segments.filter((segment) => segment.bold && segment.text.trim());
  if (keys.map((segment) => segment.text.trim()).join("|") !== "enter|esc") return null;
  let start = end - 1;
  for (; start >= Math.max(0, end - 100); start--) {
    if (HEADER.test(texts[start]!)) break;
  }
  if (start < Math.max(0, end - 100) || !painted(lines[start]!, "dim")) return null;
  const first = texts.findIndex((text, row) => row > start && row < end && OPTION.test(text));
  if (first < 0) return null;

  const background = lines[start]!.segments.find((segment) => segment.text.trim())?.bg;
  const prompt = lines.slice(start + 1, first);
  const ink = prompt.flatMap((line) => line.segments.filter((segment) => segment.text.trim()));
  if (!ink.length || ink.some((segment) => segment.bold || segment.dim || segment.bg !== background || segment.fg !== ink[0]!.fg)) return null;
  const copy = texts.slice(start + 1, first).map((text) => text.trim());
  while (copy.at(-1) === "") copy.pop();
  const separator = copy.indexOf("");
  const title = (separator < 0 ? copy : copy.slice(0, separator)).join(" ");
  if (!title) return null;
  const description = separator < 0 ? [] : copy.slice(separator + 1);

  const options: PickerOption[] = [];
  let column = 0;
  for (let row = first; row < end; row++) {
    const text = texts[row]!;
    if (!text.trim()) {
      if (texts.slice(row, end).some((line) => line.trim())) return null;
      break;
    }
    const match = OPTION.exec(text);
    if (!match) {
      const previous = options.at(-1);
      if (!previous || text.search(/\S/) < column) return null;
      previous.description += " " + text.trim();
      continue;
    }
    if (Number(match[1]) !== options.length + 1) return null;
    const pointed = text.startsWith("  › ");
    if (pointed && !pointedRow(lines[row]!)) return null;
    options.push({ id: match[1]!, label: match[2]!, description: match[3]!, pointed,
      current: false, checked: false, orderable: false });
    column = text.length - match[3]!.length;
  }
  if (options.length < 2 || options.filter((option) => option.pointed).length !== 1) return null;
  if (options[0]!.label !== "Allow" || options.at(-1)!.label !== "Cancel") return null;
  let previousChoice = -1;
  for (const option of options) {
    const choice = CHOICES.findIndex(([label, detail]) => label === option.label && detail === option.description);
    if (choice <= previousChoice) return null;
    previousChoice = choice;
  }

  const signature = regionSignature(lines, start, end + 1);
  return {
    startLine: start,
    model: {
      kind: "single", identity: `elicitation:${title}\n${description.join("\n")}`, title, description,
      options, query: null, preview: [], footer: FOOTER, signature, regionSignature: signature,
    },
  };
}
