import { lineText, type StyledLine } from "../../blocks";
import { tableRuns } from "../../table-run";

const ANSWER_LEAD = /^(?:\u2022| {2}-)\s+/;
const TOOL_EVENT = /^\u2022\s+(?:Called|Edited|Explored|Ran|Read|Running|Searched|Viewed|Working|You have)(?:\s|$)/;
const TURN_BOUNDARY = /^(?:\u203a(?:\s|$)|[\u2500\u2501\u2550]|-+\s+Worked for\b)/;
const RECAP_HEADING = /^[-\u2500\u2501\u2550]+ +Conversation recap +[-\u2500\u2501\u2550]+\s*$/;
const STRUCTURE = /^(?:(?:[-+*\u2022]|\d+[.)])(?:\s|$)|[|>#{}\u2500-\u257f]|`{3}|~{3})/;

function proseAt(text: string, indent: number): boolean {
  const content = text.slice(indent);
  return text.startsWith(" ".repeat(indent)) && /^\S/.test(content) && !STRUCTURE.test(content);
}

function protectedLine(line: StyledLine): boolean {
  return Boolean(line.noWrap) || line.segments.some((segment) => segment.bg !== undefined);
}

function trimEnd(line: StyledLine): StyledLine {
  const segments = [...line.segments];
  while (segments.length && !segments.at(-1)!.text.trimEnd()) segments.pop();
  const last = segments.at(-1);
  if (last) segments[segments.length - 1] = { ...last, text: last.text.trimEnd() };
  return { ...line, segments };
}

function joiner(previous: string, next: string): string {
  const before = previous.at(-1) ?? "";
  const after = next.at(0) ?? "";
  // CJK wraps need no inserted space; Latin words (also after punctuation) do.
  const words = /[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after);
  const latin = /[A-Za-z0-9]/.test(before + after);
  const punctuation = /[,.;:!?)]/.test(before) && /[A-Za-z0-9]/.test(after);
  return (words && latin) || punctuation ? " " : "";
}

function mergeLine(previous: StyledLine, next: StyledLine, indent: number): StyledLine {
  const trimmed = trimEnd(previous);
  let prefix = joiner(lineText(trimmed), lineText(next).slice(indent));
  let remaining = indent;
  const segments = [...trimmed.segments];
  for (const segment of next.segments) {
    const drop = Math.min(remaining, segment.text.length);
    remaining -= drop;
    const text = segment.text.slice(drop);
    if (!text) continue;
    segments.push({ ...segment, text: prefix + text });
    prefix = "";
  }
  return trimEnd({ ...previous, segments });
}

/** Codex's answer gutter identifies prose wraps in the host's already-rendered PTY rows.
 * Reflow only display copies, after dialog detection: prompt bindings need the original rows. */
export function reflowCodexAnswers(lines: StyledLine[]): StyledLine[] {
  const tableLines = new Set(tableRuns(lines).flatMap(({ start, end }) => lines.slice(start, end + 1)));
  let output: StyledLine[] | undefined;
  let insideAnswer = false;
  let fence: string | undefined;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const text = lineText(line);
    const recap = RECAP_HEADING.test(text);
    if (recap || TOOL_EVENT.test(text) || TURN_BOUNDARY.test(text.trimStart())) {
      // A recap opens plain answer prose without the bullet that starts an ordinary response.
      insideAnswer = recap;
      fence = undefined;
      output?.push(line);
      continue;
    }

    const lead = ANSWER_LEAD.exec(text)?.[0];
    const content = (lead ? text.slice(lead.length) : text).trimStart();
    const marker = /^(?:`{3,}|~{3,})/.exec(content)?.[0];
    if (fence) {
      if (marker?.startsWith(fence) && content.slice(marker.length).trim() === "") fence = undefined;
      output?.push(line);
      continue;
    }
    if (!lead && /^\S/.test(text)) insideAnswer = false;
    if (lead && /^\S/.test(content)) insideAnswer = true;
    if (insideAnswer && marker) {
      fence = marker;
      output?.push(line);
      continue;
    }

    const indent = lead && !STRUCTURE.test(content)
      ? lead.length
      : insideAnswer && proseAt(text, 2) ? 2 : null;
    if (indent === null || protectedLine(line) || tableLines.has(line)) {
      output?.push(line);
      continue;
    }

    let merged = line;
    while (index + 1 < lines.length) {
      const next = lines[index + 1]!;
      if (protectedLine(next) || tableLines.has(next) || !proseAt(lineText(next), indent)) break;
      output ??= lines.slice(0, index);
      merged = mergeLine(merged, next, indent);
      index++;
    }
    output?.push(merged);
  }
  return output ?? lines;
}
