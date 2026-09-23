import type { AnsiSegment } from "../../ansi";
import { lineText, type SessionInfo, type SessionInfoText, type StartupDetails, type StyledLine } from "../../blocks";
import { displayWidth } from "../../text-width";

type HistoryMessage = NonNullable<Extract<SessionInfo, { kind: "history" }>["messages"]>[number];
type GroupKind = StartupDetails["groups"][number]["kind"];

/** Keep source rows in place, assigning search offsets after selecting their meaningful spans. */
function sourceText(lines: StyledLine[]) {
  const rows: { sourceStart: number; value: SessionInfoText; segments: AnsiSegment[] }[][] = lines.map(() => []);
  function select(row: number, start: number, end: number, trimStart = true): SessionInfoText | undefined {
    const text = lineText(lines[row]!);
    if (trimStart) start += text.slice(start, end).length - text.slice(start, end).trimStart().length;
    end = start + text.slice(start, end).trimEnd().length;
    if (start >= end) return undefined;
    const value = { start: 0, text: text.slice(start, end) };
    let at = 0;
    const segments = lines[row]!.segments.flatMap((segment) => {
      const from = Math.max(0, start - at);
      const to = Math.min(segment.text.length, end - at);
      at += segment.text.length;
      return from < to ? [{ ...segment, text: segment.text.slice(from, to) }] : [];
    });
    rows[row]!.push({ sourceStart: start, value, segments });
    return value;
  }
  function finish(): StyledLine[] {
    let offset = 0;
    return rows.map((parts, row) => {
      const segments: AnsiSegment[] = [];
      for (const part of parts.toSorted((a, b) => a.sourceStart - b.sourceStart)) {
        if (segments.length) {
          segments.push({ ...segments.at(-1)!, text: " " });
          offset++;
        }
        part.value.start = offset;
        segments.push(...part.segments);
        offset += part.value.text.length;
      }
      offset++;
      return Object.assign({}, lines[row], { segments, noWrap: false });
    });
  }
  return { select, finish };
}

function displayIndexAt(text: string, target: number): number {
  let index = 0;
  let width = 0;
  for (const character of text) {
    if (width >= target) break;
    width += displayWidth(character);
    index += character.length;
  }
  return index;
}

const LOGO = /^[█╗╔╚╝║═⠀-⣿]+$/u;

/** Called only for the complete, styled startup frame verified by foldStartupInfo. */
export function extractStartupDetails(lines: StyledLine[]) {
  const top = lines.findIndex((line) => /^╭─+.*Hermes Agent v/u.test(lineText(line)));
  if (top < 0) return null;
  const title = lineText(lines[top]!);
  const build = /\b(v[\w.+-]+.*?)\s*─+╮$/u.exec(title);
  const heading = lines.map(lineText).find((text) => text.includes("Available Tools"));
  if (!build || !heading) return null;
  const column = displayWidth(heading.slice(0, heading.indexOf("Available Tools")));
  const source = sourceText(lines);
  const details: StartupDetails = { fields: [], groups: [], notes: [] };
  const buildValue = source.select(top, build.index, build.index + build[1]!.length);
  if (buildValue) details.fields.push({ label: "build", value: buildValue });
  let section: StartupDetails["groups"][number] | undefined;

  for (let row = top + 1; row < lines.length; row++) {
    const text = lineText(lines[row]!);
    if (/^╰─+╯$/u.test(text)) break;
    const split = displayIndexAt(text, column);
    const left = text.slice(1, split).trim();
    const right = text.slice(split, -1).trim();
    const leftStart = text.indexOf(left, 1);
    const rightStart = text.indexOf(right, split);
    const model = /^(.*?)\s+·\s+(.+)$/u.exec(left);
    const session = /^Session:\s*(\S+)/u.exec(left);
    const field = (label: StartupDetails["fields"][number]["label"], start: number, end: number) => {
      const value = source.select(row, start, end);
      if (value) details.fields.push({ label, value });
    };
    if (model) {
      field("model", leftStart, leftStart + model[1]!.length);
      field("provider", leftStart + left.lastIndexOf(model[2]!), split);
    } else if (left.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(left)) {
      field("directory", leftStart, split);
    } else if (session) {
      field("session", leftStart + left.indexOf(session[1]!), leftStart + left.length);
    } else if (left && !LOGO.test(left.replace(/\s/gu, ""))) {
      const note = source.select(row, 1, split);
      if (note) details.notes.push(note);
    }

    const kind: GroupKind | undefined = right === "Available Tools" ? "tools"
      : right === "MCP Servers" ? "mcp" : right === "Available Skills" ? "skills" : undefined;
    if (kind) {
      section = { kind, items: [], notes: [] };
      details.groups.push(section);
      continue;
    }
    if (!right) continue;
    if (/^\d+ tools? · \d+ skills? · /u.test(right)) {
      const help = right.indexOf("/help");
      if (help >= 0) {
        const note = source.select(row, rightStart + help, text.length - 1);
        if (note) details.notes.push(note);
      }
      continue;
    }
    if (!section || right.startsWith("⚠")) {
      const note = source.select(row, split, text.length - 1);
      if (note) details.notes.push(note);
      continue;
    }
    const separator = section.kind === "mcp" ? right.search(/\s+\(/u) : right.indexOf(":");
    if (separator > 0) {
      const name = source.select(row, rightStart, rightStart + separator)!;
      const detail = source.select(row, rightStart + separator + (section.kind === "mcp" ? 0 : 1), text.length - 1);
      section.items.push({ name, ...(detail && { detail }) });
    } else {
      const note = source.select(row, split, text.length - 1);
      if (note) section.notes.push(note);
    }
  }
  const order = ["model", "provider", "directory", "session", "build"];
  details.fields = details.fields.toSorted((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  return { lines: source.finish(), details };
}

/** Frame rows are already blanked by foldResumedHistory; remove only native role padding. */
export function extractHistoryMessages(lines: StyledLine[]) {
  const source = sourceText(lines);
  const runs: { role: HistoryMessage["role"]; first: SessionInfoText; last: SessionInfoText }[] = [];
  let current: (typeof runs)[number] | undefined;
  let role: HistoryMessage["role"] = "event";
  let announcement = false;
  const append = (entryRole: HistoryMessage["role"], value: SessionInfoText | undefined) => {
    if (!value) return;
    if (!current || current.role !== entryRole) {
      current = { role: entryRole, first: value, last: value };
      runs.push(current);
    } else current.last = value;
  };

  for (let row = 0; row < lines.length; row++) {
    const text = lineText(lines[row]!);
    const prefix = /^ {2}(● You: |◆ Hermes: |◈ )/u.exec(text);
    if (!prefix && (announcement || /^\s*↻ Resumed session /u.test(text) || /^\s*Model restored from session: /u.test(text))) {
      announcement = !/\d+ total messages\)\s*$/u.test(text);
      continue;
    }
    announcement = false;
    if (prefix) {
      role = prefix[1] === "● You: " ? "user" : prefix[1] === "◆ Hermes: " ? "assistant" : "event";
      current = undefined;
    }
    const indent = role === "user" ? 9 : role === "assistant" ? 12 : 4;
    const start = prefix?.[0].length ?? (text.startsWith(" ".repeat(indent)) ? indent : 0);
    const tool = role === "assistant" ? /\[\d+ tool calls?:[^\]]*\]\s*$/u.exec(text) : null;
    append(role, source.select(row, start, tool?.index ?? text.length, false));
    if (tool) {
      append("tools", source.select(row, tool.index, text.length));
      current = undefined;
    }
  }
  const normalized = source.finish();
  const searchable = normalized.map(lineText).join("\n");
  const messages: HistoryMessage[] = runs.map(({ role: entryRole, first, last }) => ({
    role: entryRole,
    content: { start: first.start, text: searchable.slice(first.start, last.start + last.text.length) },
  }));
  return { lines: normalized, messages };
}
