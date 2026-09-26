// Codex's SAVED-SESSION picker — `/resume` inside a session, `codex resume`/`codex fork` from
// a shell. Unlike the bottom-pane model picker (picker.ts), this one is a FULL-SCREEN view with its
// own search field, a filter/status/sort toolbar, two row densities and a footer progress rule.
// RESUME_NOTES.md records the captures and the verified key recipes; parsing here stays I/O-free.
//
// Nothing here synthesises a key: the card offers the Up/Down browse, Enter (resume/fork/restore) and
// the search field the screen itself prints. `ctrl+a` (archive), `ctrl+t` (transcript), `ctrl+e`
// (expand), `ctrl+o` (density) and the `tab` toolbar are deliberately not driven — an EXPANDED row
// (the `⌄` marker) refuses the whole screen instead, so a half-understood detail block can never be
// read as a row.

import { lineText, type StyledLine } from "../../blocks";
import type { PickerModel, PickerOption } from "../picker-model";
import { lastNonBlankIndex, painted, rstrip } from "./markers";

/** `SessionPickerAction::title()` — the two actions that draw this screen. */
const TITLE = /^(?:Resume|Fork) a previous session$/;
/** The search row, left-chromed by one column. Codex's own search keeps its text free of spaces. */
const SEARCH = /^ (?:Type to search|Search: (\S*))/;
const TOOLBAR = /^ Filter:\s+Cwd\s+All\s+Status:\s+Active\s+Archived\s+Sort:\s+Updated\s+Created$/;
/** The footer's progress rule: a full-width `─` rail with its label painted over the right end. */
const PROGRESS = /^─+ (\d+) ?\/ ?(\d+) · \d+% ?─$/;
/** `format_relative_time` — everything the 12-column date cell can hold. */
const RELATIVE_TIME = /^(?:now|\d+s ago|\d+m ago|\d+h ago|\d+d ago|-)$/;
/** `selection_marker` inside the 4-column list inset: `› ` selected, `⌄ ` expanded. */
const ROW = /^ {2}([›⌄] | {2})(.*)$/;
/** Non-row chrome the list viewport itself paints. */
const MORE = /^(?:↑ more|↓ more|↓ loading more)$/;
const STATUS_LINE =
  /^(?:No sessions yet|No results for your search|Searching…|Loading sessions…|Loading older sessions…|Search scanned first \d+ sessions; more may exist)$/;
/** `ctrl+o`'s label names the density you are NOT in — a cross-check on the geometry below. */
const DENSITY_HINT = /ctrl\+o +(comfy|dense)\b/;

/** `SESSION_META_DATE_WIDTH` — the fixed date cell both densities share. */
const DATE_WIDTH = 12;
const DATE_FROM = 4;
const DATE_TO = DATE_FROM + DATE_WIDTH;
/** The picker draws the whole screen, so a region longer than this is not one widget. */
const MAX_REGION_LINES = 200;
/** The footer is a rule plus its hints; anything else between them is not this view. */
const MAX_FOOTER_LINES = 3;

export interface ResumeRegion {
  startLine: number;
  model: PickerModel;
}

/** The padded date cell, or null when this row does not carry one at all. */
function dateCell(text: string): string | null {
  if (text.length < DATE_TO) return null;
  const cell = text.slice(DATE_FROM, DATE_TO);
  const value = rstrip(cell);
  if (!RELATIVE_TIME.test(value)) return null;
  // The cell is padded to its full width; a value that filled it would leave no gap before the
  // title. Real values are seven columns at most, so a tight cell means the frame was not this row.
  return value.length < cell.length ? value : null;
}

/** The meta row under a comfortable-mode title: the same date cell, then `⌁ cwd` / ` branch`. */
function metaCopy(text: string): string | null {
  const date = dateCell(text);
  if (date === null) return null;
  const fields = rstrip(text.slice(DATE_TO))
    // The branch/cwd icons are Nerd Font private-use glyphs drawn for the terminal's own font; the
    // card shows this copy in the app face, where they render as tofu. The value is what matters.
    .replace(/[\u{E000}-\u{F8FF}]/gu, "")
    .split(/ {2,}/)
    .map((field) => field.trim())
    .filter(Boolean);
  return [date, ...fields].join(" · ");
}

/** The marker glyph painted by `selection_marker`, and whether the renderer bolded it. */
function marker(line: StyledLine, glyph: string): boolean | null {
  const segment = line.segments.find((candidate) => candidate.text.includes(glyph));
  return segment ? segment.bold === true : null;
}

function readRows(
  lines: StyledLine[],
  texts: string[],
  from: number,
  to: number,
): { options: PickerOption[]; density: "dense" | "comfortable" | null } | null {
  const options: PickerOption[] = [];
  let density: "dense" | "comfortable" | null = null;
  for (let index = from; index < to; ) {
    const text = texts[index]!;
    if (!text.trim()) {
      index++;
      continue;
    }
    if (MORE.test(text.trim()) || STATUS_LINE.test(text.trim())) {
      // "No sessions yet" / "No results" own an EMPTY list; after a row it would be unread chrome.
      if (options.length > 0) return null;
      index++;
      continue;
    }
    const row = ROW.exec(text);
    if (!row) return null;
    const rowLine = index;
    const glyph = row[1]!;
    if (glyph === "⌄ ") return null; // the expanded detail block is not a row grammar
    const cell = dateCell(text);
    if (density === null) density = cell === null ? "comfortable" : "dense";
    if ((density === "dense") !== (cell !== null)) return null;

    let label: string;
    let description: string;
    if (density === "dense") {
      label = rstrip(text.slice(DATE_TO));
      description = cell!;
      index++;
    } else {
      const meta = index + 1 < to ? metaCopy(texts[index + 1]!) : null;
      label = rstrip(row[2]!);
      description = meta ?? "";
      index += meta === null ? 1 : 2;
    }
    const pointed = glyph !== "  ";
    // Codex paints the marker it just drew; an unpainted one is a stale or torn frame, not a row.
    if (pointed && marker(lines[rowLine]!, glyph) !== true) return null;
    if (!label) return null;
    options.push({
      id: label,
      label,
      description,
      pointed,
      current: false,
      checked: false,
      orderable: false,
    });
  }
  return { options, density };
}

/** The full-screen session picker, or null when this buffer is not that screen. */
export function detectResumeRegion(lines: StyledLine[]): ResumeRegion | null {
  const texts = lines.map((line) => rstrip(lineText(line)));
  const tail = lastNonBlankIndex(texts);
  if (tail < 0) return null;

  let start = -1;
  for (let index = tail; index >= 0; index--) {
    if (!TITLE.test(texts[index]!.trim())) continue;
    if (!painted(lines[index]!, "bold")) return null;
    start = index;
    break;
  }
  if (start < 0 || tail - start > MAX_REGION_LINES) return null;
  // The header owns the top of a screen it clears itself: nothing but blanks may precede it.
  if (texts.slice(0, start).some((text) => text.trim() !== "")) return null;

  const searchIndex = start + 4;
  if (
    searchIndex + 1 > tail || texts[start + 1]?.trim() !== "" ||
    !TOOLBAR.test(texts[start + 2] ?? "") || texts[start + 3]?.trim() !== "" ||
    texts[searchIndex + 1]?.trim() !== ""
  ) {
    return null;
  }
  const search = SEARCH.exec(texts[searchIndex]!);
  if (!search) return null;
  const query = search[1] ?? "";

  let rule = -1;
  for (let index = tail; index > searchIndex; index--) {
    const segments = lines[index]!.segments.filter((segment) => segment.text.trim());
    if (PROGRESS.test(texts[index]!.trim()) && segments[0]?.dim === true && segments.at(-1)?.dim === true) {
      rule = index;
      break;
    }
  }
  if (rule < 0) return null;
  const footer = texts.slice(rule + 1, tail + 1).filter((text) => text.trim() !== "");
  // Every hint row is left-padded by one column and holds only the keys the screen advertises, so
  // transcript output arriving under a half-drawn footer can never be read as part of this dialog.
  if (
    footer.length > MAX_FOOTER_LINES ||
    footer.some((text) =>
      !text.startsWith(" ") || ROW.test(text) || MORE.test(text.trim()) || STATUS_LINE.test(text.trim())
    )
  ) {
    return null;
  }

  const rows = readRows(lines, texts, searchIndex + 2, rule);
  if (!rows) return null;
  if (rows.options.filter((option) => option.pointed).length !== (rows.options.length > 0 ? 1 : 0)) {
    return null;
  }

  // Titles can be identical (including native truncation). The footer gives the selected
  // row's absolute position, so IDs stay distinct and stable when the visible window scrolls.
  const progress = PROGRESS.exec(texts[rule]!.trim())!;
  const selected = Number(progress[1]);
  const total = Number(progress[2]);
  const first = selected - rows.options.findIndex((option) => option.pointed);
  if (!Number.isSafeInteger(selected) || !Number.isSafeInteger(total)) return null;
  if (rows.options.length === 0 ? selected !== 0 || total !== 0
    : first < 1 || first + rows.options.length - 1 > total) return null;
  rows.options.forEach((option, index) => {
    option.id = `${first + index}:${option.label}`;
  });

  // The footer names the other density; when it is legible it must agree with the geometry.
  const hint = footer.join(" ").match(DENSITY_HINT)?.[1];
  const named = hint === undefined ? null : hint === "dense" ? "comfortable" : "dense";
  if (named !== null && rows.density !== null && named !== rows.density) return null;

  const title = texts[start]!.trim();
  const region = texts.slice(start, tail + 1).join("\n");
  return {
    startLine: start,
    model: {
      kind: "single",
      identity: `resume:${title}`,
      sessionAction: title.startsWith("Fork") ? "fork" : "resume",
      title,
      description: [],
      options: rows.options,
      query,
      preview: [],
      footer: footer.join("\n"),
      signature: region,
      regionSignature: region,
    },
  };
}
