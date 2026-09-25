import type { AnsiSegment } from "../../ansi";
import { lineText, trimTrailingBlank, type Block, type RawBlock, type StyledLine } from "../../blocks";
import { displayWidth } from "../../text-width";
import type { HarnessAdapter } from "../types";
import { decorateHermesDiff } from "./display";
import { detectClarify } from "./clarify";
import { extractHistoryMessages, extractStartupDetails } from "./session-info";

// Hermes chrome and verified clarify cards. Ordinary text replies retain their existing
// transport; clarify option digits use the shared fresh-dialog guard.
const RULE = /^─{8,}$/u;
const RESPONSE_TOP = /^╭─\s*([⚕☤]\s*Hermes(?:\s+\d{2}:\d{2}(?::\d{2})?)?)\s*─{8,}╮$/u;
const RESPONSE_BOTTOM = /^╰─{8,}╯$/u;
const STATUS_HEAD = /^\s*[⚕☤]\s+\S/u;
const CONTEXT = /(?:ctx\s+--|~?[\d.]+[KMB]?\/[\d.]+[KMB]?|\[[█░]+\]\s*(?:~?\d+(?:\.\d+)?%|--))/u;
const WORKING_HINT = "msg=interrupt · /queue · /bg · /steer · Ctrl+C cancel";
/**
 * The prompt row's LEADING ICON is state-dependent, and the set is closed — `cli_tui_mixin.py`'s
 * `_get_tui_prompt_fragments` paints exactly: ⚕/☤ working · ? clarify · ✎ clarify-freetext · ⚠
 * approval · 🔐 sudo · 🔑 secret · ● ◉ 🎤 voice · a busy-command spinner frame (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`,
 * cli.py `_COMMAND_SPINNER_FRAMES`, advancing ten times a second) — optionally preceded by a
 * non-default profile name (`coder ❯`), and optionally followed by `❯` (minimal chrome omits it).
 * Every glyph outside `[⚕?✎❯]` once rejected its whole footer: the /compact screen (spinner) and
 * every password prompt (🔑) left the statusline, wrapped across rows, stranded in the mirror.
 */
const STATE_ICON = "[⚕☤⚠?✎🔐🔑●◉🎤]|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]";
/** A profile name is a WORD (cli profiles): letters, digits, `_`/`-` — never an emoji, so an
 * unknown icon followed by `❯` still reads as unknown rather than as somebody's profile. */
const PROFILE = "[\\p{L}\\p{N}_-]+";
const PROMPT = new RegExp(`^(?:(?:${PROFILE} )?(?:❯(?: |$)|(?:${STATE_ICON}) (?:❯(?: |$))?))`, "u");
/** A frame border whose row cannot carry its closing corner: the pane cut it. See {@link rejoinWrappedBorders}. */
const BORDER_OPEN = /^(?:╭─\s*[⚕☤]\s*Hermes|╰─{8,})/u;
/** What such a border continues onto — the rest of the dashes, corner last. */
const BORDER_TAIL = /^─{8,}[╮╯]?$/u;
/** Rows one border may be spread over before it stops looking like a border. */
const BORDER_MAX_ROWS = 4;

function sliceSegments(segments: AnsiSegment[], start: number, end: number): AnsiSegment[] {
  let offset = 0;
  return segments.flatMap((segment) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(segment.text.length, end - offset);
    offset += segment.text.length;
    return from < to ? [{ ...segment, text: segment.text.slice(from, to) }] : [];
  });
}

/** A frame segment keeps the terminal's ink: see the note in {@link fitResponseRule}. */
function keepSkinInk(segment: AnsiSegment): AnsiSegment {
  return { ...segment, muted: false };
}

interface Footer {
  statusStart: number;
  top: number;
  empty: boolean;
  clarify: boolean;
  hint?: StyledLine;
}

function locateFooter(lines: StyledLine[]): Footer | null {
  const texts = lines.map(lineText);
  let bottom = texts.length - 1;
  while (bottom >= 0 && texts[bottom]!.trim() === "") bottom--;
  if (bottom < 2 || !RULE.test(texts[bottom]!.trim())) return null;
  for (let prompt = bottom - 1; prompt >= Math.max(1, bottom - 100); prompt--) {
    const text = texts[prompt]!;
    if (RULE.test(text.trim())) return null;
    const promptMatch = PROMPT.exec(text);
    if (!promptMatch) continue;
    const top = prompt - 1;
    if (!RULE.test(texts[top]!.trim()) || texts[top]!.trim() !== texts[bottom]!.trim()) return null;
    const draft = sliceSegments(lines[prompt]!.segments, promptMatch[0].length, text.length);
    const continuation = lines.slice(prompt + 1, bottom).flatMap((line) => line.segments);
    const input = [...draft, ...continuation];
    // A placeholder is ALL-ITALIC input. Whether it is lifted into the fixed strip depends on the
    // state, because the italic style alone does not tell instruction from suggestion: on the
    // states whose prompt REPLACES the composer with an instruction (⚠ approval · 🔐 sudo · 🔑
    // secret · ● ◉ 🎤 voice · a busy command's spinner — "type password…", "⠋ Compressing
    // context…") it is lifted, so the composer block can leave the mirror without taking the words
    // with it. On ⚕/☤ the only lifted placeholder is the verified working hint (canonical one-line
    // spelling — physical wrapping mangles the join); an UNKNOWN italic there, and every idle ❯
    // suggestion, keep the composer visible exactly as before (clarify's own card carries ?/✎).
    // Typed copies are never italic, so a draft is never lifted.
    const placeholder = input.find((s) => s.text.trim());
    const placeholderText = input.map((s) => s.text).join("").trim();
    const isPlaceholder = placeholder !== undefined && input.every((s) => !s.text.trim() || s.italic);
    const instructing = /^(?:\S+ )?(?:[⚠🔐🔑●◉🎤]|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]) /u.test(text);
    const hint = !isPlaceholder ? undefined
      : placeholderText.replace(/\s/gu, "") === WORKING_HINT.replace(/\s/gu, "")
        ? { segments: [{ ...placeholder!, text: WORKING_HINT }] }
        : instructing ? { segments: [{ ...placeholder!, text: placeholderText }] } : undefined;
    if (!hint && texts.slice(prompt + 1, bottom).some((row) => row.trim() && !/^ {2}/u.test(row))) return null;
    for (let statusStart = top - 1; statusStart >= Math.max(0, top - 6); statusStart--) {
      if (!STATUS_HEAD.test(texts[statusStart]!)) continue;
      const status = texts.slice(statusStart, top).join(" ");
      if (!status.includes("│") || !CONTEXT.test(status)) return null;
      // Suggestions are italic. Real drafts remain visible until their editing/submit contract
      // is verified; hiding someone else's typed text would lose it.
      const empty = !!hint || (/^[⚕☤] /u.test(text)
        ? input.every((s) => !s.text.trim())
        : draft.every((s) => !s.text.trim() || s.italic) && continuation.every((s) => !s.text.trim()));
      return { statusStart, top, empty, hint, clarify: text.startsWith("? ") };
    }
    return null;
  }
  return null;
}

function fitResponseRule(line: StyledLine): StyledLine {
  const text = lineText(line);
  const end = text.length - 1;
  const start = /─+[╮╯]$/u.exec(text)?.index;
  if (start === undefined) return line;
  // THE FRAME IS THE SKIN'S LINE, NOT APP CHROME. `checkMuted` (lib/ansi.ts) sees a row of nothing
  // but rule glyphs and marks it decorative, which mirror-space.ts repaints neutral — right for a
  // separator, wrong for a border the terminal painted in its accent. It showed as a message whose
  // TOP border was gold and whose BOTTOM one was grey, and on a wrapped frame as a gold line that
  // turned grey halfway along (measured on the operator's pane, 2026-09-14). Clear the flag here:
  // this row is adapter-verified as a frame, which is exactly the context the parser lacks.
  const leading = sliceSegments(line.segments, 0, start).map(keepSkinInk);
  const rule = sliceSegments(line.segments, start, end).map(keepSkinInk);
  const trailing = sliceSegments(line.segments, end, text.length).map(keepSkinInk);
  return {
    ...line,
    segments: [...leading, ...rule, ...trailing],
    fitRule: { start: leading.length, end: leading.length + rule.length },
  };
}

/**
 * Put a frame border the PANE cut back on one row.
 *
 * A frame is drawn at the width of the terminal that was on screen when the message completed, and
 * Herdr re-wraps those scrollback rows at whatever width the pane has NOW — so a frame from a wider
 * window (measured: a 211-column frame read back from a 160-column pane) arrives as its own
 * continuation: `╭─ ⚕ Hermes ───…` on one row, `───…╮` on the next.
 *
 * Every pattern below is anchored to a whole row, so such a border reads as ordinary dashes, the
 * frame is never fitted, and the operator is left with the box's leftovers — a stray `╮` at the
 * start of the message and a `╯` at the end, which is exactly what the fitting exists to remove.
 *
 * The rows it was cut over are EMPTIED rather than deleted. Source-row indices must keep lining up
 * with the screen (`latest-reply` maps a reply's last row onto this array before hiding it), and a
 * blank row where the wrap was is the cheapest price for that; the border's own corner travels onto
 * the joined row, so nothing the operator was meant to see is lost.
 */
function rejoinWrappedBorders(lines: StyledLine[]): StyledLine[] {
  const joined = [...lines];
  for (let top = 0; top < joined.length - 1; top++) {
    const opening = lineText(joined[top]!);
    if (!BORDER_OPEN.test(opening) || /[╮╯]$/u.test(opening)) continue;
    const segments = [...joined[top]!.segments];
    let bottom = top;
    while (bottom + 1 < joined.length && bottom - top < BORDER_MAX_ROWS) {
      const next = lineText(joined[bottom + 1]!);
      if (!BORDER_TAIL.test(next)) break;
      bottom++;
      segments.push(...joined[bottom]!.segments);
      if (/[╮╯]$/u.test(next)) break;
    }
    // Only a border that reaches its corner is a border. Anything else was dashes that happened to
    // follow one, and guessing there would eat a rule the operator was meant to read.
    if (bottom === top || !/[╮╯]$/u.test(lineText(joined[bottom]!))) continue;
    // Reaching the corner is proof enough to fit it: this is a frame, whether or not the row that
    // opened it is still on screen — and a lone closing border left as raw dashes is the very
    // leftover the fitting exists to remove.
    joined[top] = fitResponseRule({ ...joined[top]!, segments });
    for (let i = top + 1; i <= bottom; i++) joined[i] = { ...joined[i]!, segments: [] };
    top = bottom;
  }
  return joined;
}

function responseChrome(lines: StyledLine[], closingWidth: number): StyledLine[] {
  let responseWidth = 0;
  return rejoinWrappedBorders(lines).map((line, index, all) => {
    const text = lineText(line);
    const header = RESPONSE_TOP.exec(text);
    if (header?.[1]) {
      responseWidth = text.length;
      return fitResponseRule(line);
    }
    const matchesClosing = (responseWidth > 0 && text.length === responseWidth) ||
      (index === all.length - 1 && text.length === closingWidth);
    if (matchesClosing && RESPONSE_BOTTOM.test(text)) {
      responseWidth = 0;
      return fitResponseRule(line);
    }
    return line;
  });
}

function inputChrome(lines: StyledLine[]): StyledLine[] {
  const result = [...lines];
  for (let top = 0; top < lines.length - 2; top++) {
    const rule = lineText(lines[top]!).trim();
    const prompt = lines[top + 1]!;
    if (!RULE.test(rule) || !lineText(prompt).startsWith("● ")) continue;
    if (!prompt.segments.find((s) => s.text.includes("●"))?.bold) continue;
    if (prompt.segments.some((s) => s.text.trim() && !s.bold && !s.dim)) continue;
    // Submitted input is bold, with optional dim timestamps/omitted-line notices. A matching
    // pair around that preview is chrome; ordinary rules and response-body bullets remain raw.
    for (let bottom = top + 2; bottom < lines.length; bottom++) {
      const line = lines[bottom]!;
      if (lineText(line).trim() === rule) {
        result[top] = { ...lines[top]!, fullWidthRule: true };
        result[bottom] = { ...line, fullWidthRule: true };
        top = bottom;
        break;
      }
      if (line.segments.some((s) => s.text.trim() && !s.bold && !s.dim)) break;
    }
  }
  return result;
}

const SPLIT_HISTORY_HEADER = /^─+ Previous Conversation ─+╮?$/u;
const HISTORY_HEADER = /^╭─+ Previous Conversation ─+╮$/u;
const STARTUP_HEADER = /^╭─+ Hermes Agent (v[\w.+-]+)(?: .*?)? ─+╮$/u;

function styledTitle(lines: StyledLine[], first: number, last: number, title: string, style: "bold" | "dim") {
  const segments = lines.slice(first, last + 1).flatMap((line) => line.segments);
  const start = segments.map((segment) => segment.text).join("").indexOf(title);
  if (start < 0) return false;
  let offset = 0;
  let covered = 0;
  for (const segment of segments) {
    const overlap = Math.max(0, Math.min(offset + segment.text.length, start + title.length) - Math.max(offset, start));
    if (overlap && !segment[style]) return false;
    covered += overlap;
    offset += segment.text.length;
  }
  return covered === title.length;
}

/** Reassemble only complete, styled Rich frames; leave incomplete frames unchanged. */
function rejoinInfoPanels(lines: StyledLine[]) {
  const result = [...lines];
  const continuations = new WeakSet<StyledLine>();
  const frames = new WeakSet<StyledLine>();
  for (let top = 0; top < lines.length; top++) {
    if (!lineText(lines[top]!).startsWith("╭─")) continue;
    const joins: [number, number][] = [];
    const bodyWidths = new Set<number>();
    let row = top;
    let header = "";
    let bottom = -1;
    let sawBody = false;
    let panelKind: "history" | "startup" | null = null;
    let hasHistoryMessage = false;
    let hasTools = false;
    let hasCounts = false;
    while (row < lines.length) {
      const text = lineText(lines[row]!);
      const kind = row === top ? "top" : text.startsWith("│") ? "body" : text.startsWith("╰─") ? "bottom" : null;
      if (!kind) break;
      const endGlyph = kind === "top" ? "╮" : kind === "bottom" ? "╯" : "│";
      let end = row;
      let joined = text;
      while (end + 1 < lines.length) {
        const next = lineText(lines[end + 1]!);
        if (joined.endsWith(endGlyph) && (kind !== "body" || /^[│╭╰]/u.test(next))) break;
        if (kind === "bottom" ? !/^─+[╯]?$/u.test(next) : /^[│╭╰]/u.test(next)) break;
        joined += next;
        end++;
      }
      const next = lines[end + 1] ? lineText(lines[end + 1]!) : "";
      const complete = joined.endsWith(endGlyph) && (kind !== "body" || !next || /^[│╭╰]/u.test(next));
      const clipped = kind === "body" && joined !== joined.trimEnd() && /^(?:│|╰─)/u.test(next);
      if (!complete && !clipped) break;
      if (end > row) joins.push([row, end]);
      if (kind === "top") {
        header = joined;
        panelKind = HISTORY_HEADER.test(header) && styledTitle(lines, row, end, "Previous Conversation", "dim") ? "history"
          : STARTUP_HEADER.test(header) && styledTitle(lines, row, end, "Hermes Agent", "bold") ? "startup" : null;
        if (!panelKind) break;
      } else if (kind === "body") {
        sawBody = true;
        if (complete) bodyWidths.add(displayWidth(joined));
        hasHistoryMessage ||= /^│\s+(?:● You:|◆ Hermes:|◈ )/u.test(joined);
        hasTools ||= /\bAvailable Tools\s*│$/u.test(joined);
        hasCounts ||= /\b\d+ tools · \d+ skills · (?:\d+ MCP servers? · )?\/help for commands\s*│$/u.test(joined);
      } else {
        const headerWidth = displayWidth(header);
        const bottomWidth = displayWidth(joined);
        const recognized = panelKind === "history" ? hasHistoryMessage : hasTools && hasCounts;
        if (sawBody && recognized && /^╰─+╯$/u.test(joined) && (headerWidth === bottomWidth
          || bodyWidths.has(headerWidth) && bodyWidths.has(bottomWidth))) bottom = end;
        break;
      }
      row = end + 1;
    }
    if (bottom < 0) continue;
    for (const [first, last] of joins) {
      result[first] = { ...lines[first]!, segments: lines.slice(first, last + 1).flatMap((line) => line.segments) };
      for (let part = first + 1; part <= last; part++) {
        result[part] = { ...lines[part]!, segments: [] };
        continuations.add(result[part]!);
      }
    }
    frames.add(result[top]!);
    top = bottom;
  }
  return { lines: result, continuations, frames };
}

/** Only a complete native resume panel folds. Keep its row count for latest-reply subtraction. */
function foldResumedHistory(lines: StyledLine[], continuations: WeakSet<StyledLine>, frames: WeakSet<StyledLine>): RawBlock[] {
  const blocks: RawBlock[] = [];
  let start = 0;
  for (let top = 0; top < lines.length; top++) {
    const header = lineText(lines[top]!);
    if (!HISTORY_HEADER.test(header) || !frames.has(lines[top]!)) continue;
    let hasMessage = false;
    for (let bottom = top + 1; bottom < lines.length; bottom++) {
      const text = lineText(lines[bottom]!);
      if (/^╰─+╯$/u.test(text)) {
        if (!hasMessage) break;
        let last = bottom;
        while (continuations.has(lines[last + 1]!)) last++;
        let first = top;
        let session: Extract<NonNullable<RawBlock["sessionInfo"]>, { kind: "history" }>["session"];
        // v0.21.4 can repaint the same panel several times as the pane scrolls: superseded panel
        // fragments (bodies, wrapped headers, lone border rows, blanks) sit between the live
        // panel and everything above. Absorb only that contiguous panel-shaped run — any other
        // output (warnings, replies) stops the walk and stays visible. When the run reaches the
        // resume announcement (optionally Rich-wrapped and/or followed by a `Model restored`
        // line), parse it and carry the session metadata into the card.
        while (first > start) {
          const t = lineText(lines[first - 1]!).trim();
          // Wrapped repaint headers can leave a title row without its left corner, sometimes
          // without the right corner too. The final complete panel and resume announcement below
          // bound the fragment run; unrelated output still stops this walk.
          if (t === "" || t.startsWith("│") || t.endsWith("│") || /^─+╮$/u.test(t)
            || SPLIT_HISTORY_HEADER.test(t) || t.startsWith("╭─") && t.includes("Previous Conversation")) first--;
          else break;
        }
        let probe = first;
        while (probe > start && !lineText(lines[probe - 1]!).trim()) probe--;
        for (let span = 1; span <= 3 && probe - span >= start; span++) {
          const rows = lines.slice(probe - span, probe);
          const joined = rows.map(lineText).map((s) => s.trim()).join(" ");
          const restored = / Model restored from session: .+$/u.exec(joined);
          const match = (restored ? joined.slice(0, restored.index) : joined)
            .match(/^↻ Resumed session ([\w-]+)(?: "(.*)")? \((\d+) user messages?, (\d+) total messages\)$/u);
          if (!match || !rows.some((row) => row.segments.some((s) => s.bold && s.text.includes(match[1]!)))) continue;
          session = { id: match[1]!, title: match[2], userMessages: Number(match[3]), totalMessages: Number(match[4]) };
          first = probe - span;
          break;
        }
        while (first > start && !lineText(lines[first - 1]!).trim()) first--; // leading blanks join the card
        if (!session) first = top; // no announcement above the fragment run: nothing may be absorbed
        if (first > start) blocks.push({ kind: "raw", lines: lines.slice(start, first) });
        const joinedRows = lines.slice(first, last + 1).filter((line) => continuations.has(line));
        const body = lines.slice(first, last + 1).flatMap((line, index) => {
          if (continuations.has(line)) return [];
          const row = first + index;
          if (row === top || row === bottom) return [Object.assign({}, line, { segments: [] })];
          if (row < top) {
            // Superseded borders and earlier-message counts are chrome. Keep their rows for source
            // offsets; the announcement and restored rows pass through for metadata extraction.
            const value = lineText(line);
            const t = value.trim();
            if (t.startsWith("╭") || /^─+╮$/u.test(t) || SPLIT_HISTORY_HEADER.test(t)
              || /^│\s+\.\.\. \d+ earlier messages \.\.\.(?:\s+│)?$/u.test(t)) return [Object.assign({}, line, { segments: [] })];
            if (!t.startsWith("│")) return [line];
            const end = (value.endsWith("│") ? value.slice(0, -1) : value).trimEnd().length;
            return [Object.assign({}, line, { noWrap: false, segments: sliceSegments(line.segments, 2, end) })];
          }
          const value = lineText(line);
          const end = (value.endsWith("│") ? value.slice(0, -1) : value).trimEnd().length;
          return [Object.assign({}, line, { noWrap: false, segments: sliceSegments(line.segments, 2, end) })];
        });
        const extracted = extractHistoryMessages(body);
        blocks.push({ kind: "raw", lines: [...extracted.lines, ...joinedRows], sessionInfo: { kind: "history", messages: extracted.messages, ...(session && { session }) } });
        start = last + 1;
        top = last;
        break;
      }
      // A repaint can open another panel before the previous one closes. Leave the old fragment raw.
      if (continuations.has(lines[bottom]!)) continue;
      if (!text.startsWith("│ ")) break;
      hasMessage ||= /^│\s+(?:● You:|◆ Hermes:|◈ )/u.test(text);
    }
  }
  if (start < lines.length || blocks.length === 0) blocks.push({ kind: "raw", lines: lines.slice(start) });
  return blocks;
}

const LOGO_ROW = /^[ █╔╗╚╝║═]+$/u;
const WELCOME = "Welcome to Hermes Agent! Type your message or /help for commands.";

/** Fold only a complete branded startup panel. Never absorb intervening warnings or replies. */
function foldStartupInfo(blocks: RawBlock[], continuations: WeakSet<StyledLine>, frames: WeakSet<StyledLine>): RawBlock[] {
  const result: RawBlock[] = [];
  let hasStartup = false;
  let afterHistory = false;
  for (const block of blocks) {
    if (block.sessionInfo) {
      result.push(block);
      afterHistory = block.sessionInfo.kind === "history";
      continue;
    }
    const { lines } = block;
    const texts = lines.map(lineText);
    let start = 0;
    for (let top = 0; top < lines.length; top++) {
      const heading = texts[top]!.match(STARTUP_HEADER);
      if (!heading || !frames.has(lines[top]!)) continue;
      let counts: RegExpMatchArray | null = null;
      let hasTools = false;
      for (let bottom = top + 1; bottom < lines.length; bottom++) {
        const text = texts[bottom]!;
        if (/^╰─+╯$/u.test(text)) {
          if (!counts || !hasTools) break;
          let last = bottom;
          while (continuations.has(lines[last + 1]!)) last++;
          let first = top;
          // The standard six-row logo is all painted box glyphs. Unknown branding stays raw.
          let logoEnd = top;
          while (logoEnd > start && !texts[logoEnd - 1]!.trim()) logoEnd--;
          const logo = lines.slice(Math.max(start, logoEnd - 6), logoEnd);
          if (logo.length === 6 && logo.every((row) => LOGO_ROW.test(lineText(row)) && row.segments.some((s) => s.fg))) {
            first = logoEnd - 6;
            while (first > start && !texts[first - 1]!.trim()) first--;
            const sessionId = texts.slice(top, bottom).join("\n").match(/\bSession: ([\w-]+)/u)?.[1];
            const command = texts[first - 1]?.trim();
            if (sessionId && command && /^(?:➜|❯|\$)\s/u.test(command)
              && command.endsWith(`hermes --resume ${sessionId}`) && !/[;&|<>]/u.test(command)) first--;
          }
          const panel = lines.slice(first, last + 1);
          const extracted = extractStartupDetails(panel.filter((line) => !continuations.has(line)));
          if (!extracted) break;
          if (first > start) result.push({ kind: "raw", lines: lines.slice(start, first) });
          result.push({ kind: "raw", lines: [...extracted.lines, ...panel.filter((line) => continuations.has(line))], sessionInfo: {
            kind: "startup", version: heading[1]!, tools: Number(counts[1]), skills: Number(counts[2]), details: extracted.details,
          } });
          start = last + 1;
          top = last;
          hasStartup = true;
          break;
        }
        if (continuations.has(lines[bottom]!)) continue;
        if (!text.startsWith("│")) break;
        hasTools ||= /\bAvailable Tools\s*│$/u.test(text);
        counts ||= text.match(/\b(\d+) tools · (\d+) skills · (?:\d+ MCP servers? · )?\/help for commands\s*│$/u);
      }
    }
    // Welcome lives after replay in Hermes. Keep these rows in place and let the renderer append
    // them to the startup card, so latest-reply subtraction still uses the original coordinates.
    if (hasStartup && (afterHistory || start > 0)) {
      let first = start;
      while (first < lines.length && !texts[first]!.trim()) first++;
      let welcome = "";
      let end = first;
      while (end < Math.min(first + 4, lines.length) && WELCOME.startsWith(welcome)) {
        welcome += (welcome ? " " : "") + texts[end++]!.trim();
        if (welcome === WELCOME) break;
      }
      if (welcome === WELCOME && lines[first]!.segments.some((s) => s.fg)) {
        while (end < lines.length && !texts[end]!.trim()) end++;
        if (texts[end]?.startsWith("✦ Tip: ") && lines[end]!.segments.every((s) => !s.text.trim() || s.dim)) end++;
        const tipLines = lines.slice(start, end).map((line) => {
          const text = lineText(line);
          const tip = text.indexOf("✦ Tip: ");
          return Object.assign({}, line, { segments: tip < 0 ? [] : sliceSegments(line.segments, tip + 7, text.trimEnd().length) });
        });
        let offset = 0;
        const tips = tipLines.flatMap((line) => {
          const text = lineText(line);
          const value = { start: offset, text };
          offset += text.length + 1;
          return text.trim() ? [value] : [];
        });
        result.push({ kind: "raw", lines: tipLines, sessionInfo: { kind: "startup-tail", tips } });
        start = end;
      }
    }
    if (start < lines.length || !lines.length) result.push({ kind: "raw", lines: lines.slice(start) });
    afterHistory = false;
  }
  return result;
}

export function hermesBuildBlocks(lines: StyledLine[]): Block[] {
  const footer = locateFooter(lines);
  const clarify = footer?.clarify && footer.empty ? detectClarify(lines, footer.statusStart) : null;
  if (clarify) {
    const before = trimTrailingBlank(lines.slice(0, clarify.start));
    const joined = rejoinInfoPanels([...decorateHermesDiff(inputChrome(responseChrome(before, 0))), ...clarify.questionLines]);
    return [
      ...foldStartupInfo(foldResumedHistory(joined.lines, joined.continuations, joined.frames), joined.continuations, joined.frames),
      { kind: "prompt-select", prompt: clarify.model, lines: lines.slice(clarify.start) },
    ];
  }
  const content = footer
    ? [...lines.slice(0, footer.statusStart), ...(footer.empty ? [] : lines.slice(footer.top))]
    : lines;
  const closingWidth = footer?.empty ? lineText(lines[footer.top]!).trim().length : 0;
  const joined = rejoinInfoPanels(decorateHermesDiff(inputChrome(responseChrome(trimTrailingBlank(content), closingWidth))));
  return foldStartupInfo(foldResumedHistory(joined.lines, joined.continuations, joined.frames), joined.continuations, joined.frames);
}

export function extractStatusLines(lines: StyledLine[]): StyledLine[] {
  const footer = locateFooter(lines);
  if (!footer) return [];
  const segments = lines.slice(footer.statusStart, footer.top).flatMap((line) => line.segments);
  const background = segments.find((s) => s.bg)?.bg;
  const rows = [{ segments }, ...(footer.hint ? [footer.hint] : [])];
  return rows.map((row) => ({ segments: row.segments.map((segment) => {
    // The title is inverse video: its former background is the readable accent, not its ink.
    const fg = segment.bg && segment.bg !== background ? segment.bg : segment.fg;
    const { backgroundColor: _background, ...style } = segment.style;
    return Object.assign({}, segment, { fg, bg: undefined, style: { ...style, color: fg } });
  }) }));
}

export const hermesAdapter: HarnessAdapter = {
  agent: "hermes",
  displayOnly: true,
  buildBlocks: hermesBuildBlocks,
  extractStatusLines,
  extractInputDraft: () => null,
};
