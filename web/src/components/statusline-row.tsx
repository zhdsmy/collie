import {
  Keyboard,
  ChevronUp,
  CalendarDays,
  Cpu,
  Database,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  CircleOff,
  FolderGit2,
  Gauge,
  GitBranch,
  Hourglass,
  ListChecks,
  Loader2,
  Pause,
  ShieldCheck,
  Tag,
  Target,
  Timer,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AnsiSegment } from "@/lib/ansi";
import type { PaneUsage, SessionModel } from "@/lib/types";
import { lineText, type StyledLine } from "@/lib/blocks";
import { segmentStyle, styleFor } from "@/components/mirror-space";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CodexModeToggle, type CodexModeToggleProps } from "@/components/codex-mode-toggle";
import { parseCodexModelField, parseCodexStatuslineField } from "@/lib/harness/codex/model-field";
import { modeFieldOf, type ClaudeModeField } from "@/lib/harness/claude/mode";
import { CLAUDE_NEW_TASK_HINT, isClaudeAsideRow } from "@/lib/harness/claude/chrome";
import { stripCodexPlanHint } from "@/lib/codex-mode-switch";
import { codexWarningCount } from "@/lib/codex-warning-action";

const CODEX_VERSION_RE = /^(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;
const BRANCH_RE = /^(main|master|develop|development|trunk|(?:feat|feature|fix|bugfix|hotfix|release|chore|refactor|test|docs)\/\S+)$/;

// These are display-only matches over complete fields, never composer recognition rules.
// Capture the value to keep it visible; the full terminal label remains the accessible name.
const CODEX_FIELDS: { pattern: RegExp; icon: LucideIcon; fill?: "currentColor"; color?: string }[] = [
  // ponytail: bare TUI fields have no type; custom branch names need upstream field metadata.
  { pattern: BRANCH_RE, icon: GitBranch },
  { pattern: /^(?:[Bb]ranch[: ]+|git[: ]+|\s+)(\S+)$/, icon: GitBranch },
  { pattern: CODEX_VERSION_RE, icon: Tag },
  { pattern: /^(?:Context|Ctx) (\d+%)$/, icon: Gauge },
  { pattern: /^Ready$/, icon: CircleCheck },
  { pattern: /^Working$/, icon: Hourglass },
  { pattern: /^Approve(?: (?:for )?me)?$/, icon: ShieldCheck },
  { pattern: /^Fast[ :]on$/, icon: Zap, fill: "currentColor", color: "var(--ansi-12)" },
  { pattern: /^Fast[ :]off$/, icon: Zap, color: "#a1a1a1" },
  { pattern: /^Tasks (\d+\/\d+)$/, icon: ListChecks },
  { pattern: /^weekly (\d+%(?: used)?)(?: left)?$/i, icon: CalendarDays },
  { pattern: /^5h (\d+%(?: used)?)(?: left)?$/i, icon: Timer },
  { pattern: /^(?:Pursuing goal|Goal:active)$/i, icon: Target },
  { pattern: /^Goal(?: paused(?: \(\/goal resume\))?|:paused)$/i, icon: Pause },
  { pattern: /^Goal(?: stalled(?: \(\/goal resume\))?|:blocked)$/i, icon: CircleAlert },
  { pattern: /^Goal(?: hit usage limits(?: \(\/goal resume\))?|:usage)$/i, icon: Gauge },
  { pattern: /^Goal(?: unmet| abandoned|:budget|:abandoned)$/i, icon: CircleOff },
  { pattern: /^Goal(?: achieved|:done)$/i, icon: CircleCheck },
];

function sliceSegments(segments: AnsiSegment[], start: number, end: number): AnsiSegment[] {
  const result: AnsiSegment[] = [];
  let offset = 0;
  for (const segment of segments) {
    const from = Math.max(0, start - offset);
    const to = Math.min(segment.text.length, end - offset);
    if (from < to) result.push({ ...segment, text: segment.text.slice(from, to) });
    offset += segment.text.length;
    if (offset >= end) break;
  }
  return result;
}

function StyledText({ segments }: { segments: AnsiSegment[] }) {
  return segments.map((segment, i) => (
    <span key={i} style={segmentStyle(segment)} className={segment.mobileTransparentBg ? "terminal-mobile-transparent-bg" : undefined}>{segment.text}</span>
  ));
}

function ContextField({ value, remaining }: {
  value: string;
  remaining: boolean;
}) {
  useLocale();
  const percent = Number.parseFloat(value.replace(/^~/, ""));
  const used = remaining ? 100 - percent : percent;
  const left = 100 - used;
  const shown = remaining ? value : `${value.startsWith("~") ? "~" : ""}${Number(left.toFixed(1))}%`;
  const label = t("statusline.context.remainingAria", { percent: shown });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none"
      // Dark-space paint shared by ring and number; gold and pale red stay distinct after inversion.
      style={{ color: left <= 10 ? "#fca5a5" : left <= 30 ? "#c4aa2b" : "var(--ansi-10)" }}
    >
      <span
        aria-hidden="true"
        data-status-icon="context"
        data-value={left}
        data-used={used}
        className="size-[12px] shrink-0 rounded-full"
        style={{
          background: `conic-gradient(currentColor ${left}%, rgb(255 255 255 / 22%) 0)`,
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
        }}
      />
      <span aria-hidden="true" className="inline-block min-w-[4ch] text-right tabular-nums">
        {shown}
      </span>
    </span>
  );
}

function CodexField({ segments, text, quotaUnit = true }: { segments: AnsiSegment[]; text: string; quotaUnit?: boolean }) {
  // Only explicit units are safe to label; bare legacy "Ctx N%" stays ambiguous.
  const context = /^(?:Context|Ctx) (\d+%) (left|used)$/.exec(text);
  if (context?.[1] && Number.parseInt(context[1], 10) <= 100) {
    const value = context[1];
    return (
      <ContextField
        value={value}
        remaining={context[2] === "left"}
      />
    );
  }
  // Usage windows say their own unit; read them like every other agent's quota field. A bare
  // percentage keeps the icon below because left versus used is not on screen.
  const quota = codexQuota(text);
  if (quota) {
    return <QuotaField text={text} showUnit={quotaUnit} windows={[quota]} />;
  }
  for (const { pattern, icon: Icon, fill, color } of CODEX_FIELDS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = match[1];
    const start = value ? text.indexOf(value) : 0;
    return (
      <span
        role="img"
        aria-label={text}
        title={text}
        className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none"
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "size-[12px] shrink-0",
            text === "Working" && "motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]",
          )}
          strokeWidth={2.25}
          fill={fill ?? "none"}
          style={color ? { color } : segments[0] && styleFor(segments[0])}
        />
        {value && (
          <span aria-hidden="true">
            <StyledText segments={sliceSegments(segments, start, start + value.length)} />
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-3.5 shrink-0 items-center" title={text}>
      <span><StyledText segments={segments} /></span>
    </span>
  );
}

function ClaudeField({ segments, text }: { segments: AnsiSegment[]; text: string }) {
  useLocale();
  // This configured Claude format names remaining_percentage "ctx". Do not apply that meaning
  // to Codex's ambiguous legacy Ctx field, or to arbitrary Claude status rows without pipe fields.
  const context = /^ctx (\d+(?:\.\d+)?%)$/i.exec(text);
  if (context?.[1] && Number.parseFloat(context[1]) <= 100) {
    return <ContextField value={context[1]} remaining />;
  }
  const fast = /^Fast:(on|off)$/.exec(text);
  if (fast) {
    return (
      <span role="img" aria-label={text} title={text} className="inline-flex min-h-3.5 shrink-0 items-center">
        <Zap aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25}
          fill={fast[1] === "on" ? "currentColor" : "none"}
          style={{ color: fast[1] === "on" ? "var(--ansi-12)" : "#a1a1a1" }} />
      </span>
    );
  }
  const cache = /^cache (warm|cold|unreported)(?: (\d+(?:\.\d+)?%))?$/.exec(text);
  if (cache && (!cache[2] || Number.parseFloat(cache[2]) <= 100)) {
    const state = t(cache[1] === "warm" ? "statusline.claude.cache.warm"
      : cache[1] === "cold" ? "statusline.claude.cache.cold" : "statusline.claude.cache.unreported");
    const hit = cache[2] ? t("statusline.claude.cache.hit", { value: cache[2] }) : "";
    return (
      <span role="img" aria-label={`${state}${hit ? ` · ${hit}` : ""}`} title={`${state}${hit ? ` · ${hit}` : ""}`}
        className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none">
        <Database aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25}
          style={{ color: cache[1] === "warm" ? "var(--ansi-10)" : "#a1a1a1" }} />
        <span aria-hidden="true">{state}{cache[2] && ` ${cache[2]}`}</span>
      </span>
    );
  }
  const Icon = BRANCH_RE.test(text)
    ? GitBranch
    : /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(text) ? Tag : null;
  return (
    <span className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none" title={text}>
      {Icon && <Icon aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25} />}
      <span><StyledText segments={segments} /></span>
    </span>
  );
}

function StatusIconField({
  text,
  segments,
  icon: Icon,
  value,
  animated = false,
  hourglass = false,
}: {
  text: string;
  segments: AnsiSegment[];
  icon: LucideIcon;
  value: string;
  animated?: boolean;
  hourglass?: boolean;
}) {
  const start = value ? text.indexOf(value) : 0;
  return (
    <span role="img" aria-label={text} title={text}
      className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none">
      <Icon aria-hidden="true"
        className={cn(
          "size-[12px] shrink-0",
          animated && "motion-safe:animate-spin motion-reduce:animate-none",
          hourglass && "motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]",
        )}
        strokeWidth={2.25} style={segments[0] && styleFor(segments[0])} />
      {value && (
        <span aria-hidden="true">
          <StyledText segments={sliceSegments(segments, start, start + value.length)} />
        </span>
      )}
    </span>
  );
}

interface StatuslineField {
  index: number;
  text: string;
  start: number;
}

function CursorStatusline({ row, leading }: { row: StyledLine; leading?: ReactNode }) {
  const parts = lineText(row).split(/( · )/);
  const fields: StatuslineField[] = [];
  let offset = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const text = part.trim();
    const start = offset + (text ? part.indexOf(text) : 0);
    offset += part.length;
    if (text && index % 2 === 0) fields.push({ index, text, start });
  }

  const contextIndex = fields.findIndex((field) => /^[▓░]+\s+\d+%/.test(field.text));
  const modelIndex = contextIndex >= 2 ? contextIndex - 2 : -1;
  const locationIndex = contextIndex >= 1 ? contextIndex - 1 : -1;
  return (
    <div data-slot="cursor-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {fields.map((field, position) => {
        const segments = sliceSegments(row.segments, field.start, field.start + field.text.length);
        const task = /^(\d+) tasks?$/.exec(field.text);
        const context = /^[▓░]+\s+(\d+%)\s*(.*)$/.exec(field.text);
        const plan = /^plan\s+(\d+%)\s+\(auto\s+(\d+%)\s+api\s+(\d+%)\)(?:\s+od\s+(\$[\d,.]+\/\$[\d,.]+))?\s+↻(\S+)$/i.exec(field.text);
        let content: ReactNode;
        if (task?.[1]) {
          content = <StatusIconField text={field.text} segments={segments} icon={Loader2}
            value={task[1]} animated />;
        } else if (position === modelIndex) {
          content = <StatusIconField text={field.text} segments={segments} icon={Cpu}
            value={field.text} />;
        } else if (position === locationIndex) {
          content = <StatusIconField text={field.text} segments={segments} icon={FolderGit2}
            value={field.text} />;
        } else if (context?.[1] && Number.parseInt(context[1], 10) <= 100) {
          const valueStart = field.text.indexOf(context[1]);
          const detail = context[2]?.trim() ?? "";
          content = (
            <span title={field.text}
              className="inline-flex min-h-3.5 shrink-0 items-center gap-1 leading-none">
              <ContextField value={context[1]} remaining />
              {detail && <span><StyledText segments={sliceSegments(
                segments,
                valueStart + context[1].length,
                field.text.length,
              )} /></span>}
            </span>
          );
        } else if (plan?.[1] && plan[2] && plan[3] && plan[5]) {
          content = (
            <span role="img" aria-label={field.text} title={field.text}
              className="inline-flex min-h-3.5 shrink-0 items-center gap-1 leading-none"
              style={segments[0] && styleFor(segments[0])}>
              <Gauge aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25} />
              <span aria-hidden="true">{plan[1]} <span className="opacity-70">AUTO:{plan[2]} API:{plan[3]}</span></span>
              {plan[4] && <>
                <CircleDollarSign aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25} />
                <span aria-hidden="true">{plan[4]}</span>
              </>}
              <CalendarDays aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25} />
              <span aria-hidden="true">{plan[5]}</span>
            </span>
          );
        } else {
          content = (
            <span className="inline-flex min-h-3.5 shrink-0 items-center" title={field.text}>
              <StyledText segments={segments} />
            </span>
          );
        }
        return (
          <span key={field.index} className="inline-flex shrink-0 items-center gap-1.5">
            {position > 0 && <StatuslineDivider />}
            {content}
          </span>
        );
      })}
    </div>
  );
}

// Horizontal overflow also clips vertically. Keep glyph breathing room INSIDE the scroller;
// padding on the outer status strip cannot protect a font's ascenders or descenders here.
const ROW_CLASS =
  "flex min-w-0 min-h-3.5 items-center gap-1.5 overflow-x-auto overscroll-x-contain whitespace-nowrap py-0.5 leading-none tabular-nums [scrollbar-width:none]";

type CodexControlProps = Omit<CodexModeToggleProps, "mode">;

function StatuslineDivider() {
  return <span data-slot="statusline-divider" aria-hidden="true" className="h-3 w-px shrink-0 bg-white/25" />;
}

// Keep native field contents; only separate core status, quota, and project/diagnostic details.
function fieldGroup(text: string): number {
  if (AGY_QUOTA_RE.test(text) || HERMES_QUOTA_RE.test(text) || /^(?:5h|weekly) \d+(?:\.\d+)?%/i.test(text)) return 1;
  if (BRANCH_RE.test(text) || /^(?:[Bb]ranch[: ]+|git[: ]+|\s+|⎇\s+|cache )/.test(text) || CODEX_VERSION_RE.test(text)) return 2;
  return 0;
}

function dividesFields(previous: string | undefined, current: string): boolean {
  return previous !== undefined && fieldGroup(previous) !== fieldGroup(current);
}

/**
 * Claude's user-configured statusline: `model effort | ctx N% | branch | vVERSION`, split on its own
 * separators so each field can wear an icon and a compact value.
 *
 * ONE FIELD IS DROPPED RATHER THAN DRAWN: Claude's own `new task? /clear to save N tokens` sentence,
 * which it either appends to this row (2.1.273) or paints alone on a row below the mode row (2.1.278).
 * It is a TIP, not a status field, and the actions belt carries it as a tip icon now (composer.tsx) —
 * the strip's job here is only to not print it a second time. The sentence is recognised in exactly
 * one place (`claudeHintText`, harness/claude/chrome.ts), which is what feeds that pill, so the two
 * cannot drift into disagreeing about what the tip is.
 */
function ClaudeStatusline({ row, leading }: { row: StyledLine; leading?: ReactNode }) {
  useLocale();
  let offset = 0;
  const rawFields: StatuslineField[] = [];
  for (const [index, part] of lineText(row).split(/(\s+\|\s+|(?<=\S)\s{2,}(?=\S))/).entries()) {
    const text = part.trim();
    const start = offset + part.indexOf(text);
    offset += part.length;
    if (!text || index % 2 === 1) continue;
    if (CLAUDE_NEW_TASK_HINT.test(text)) continue;
    rawFields.push({ index, text, start });
  }
  const versionIndex = rawFields.findIndex((item) => AGY_VERSION_RE.test(item.text));
  if (versionIndex !== -1 && versionIndex < rawFields.length - 1) {
    const [version] = rawFields.splice(versionIndex, 1);
    rawFields.push(version!);
  }
  const ordered = rawFields.toSorted((a, b) => fieldGroup(a.text) - fieldGroup(b.text));
  const fields = ordered.map((field, position) => (
    <span key={field.index} className="inline-flex shrink-0 items-center gap-1.5">
      {dividesFields(ordered[position - 1]?.text, field.text) && <StatuslineDivider />}
      <ClaudeField text={field.text} segments={sliceSegments(row.segments, field.start, field.start + field.text.length)} />
    </span>
  ));
  return (
    <div data-slot="claude-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {fields}
    </div>
  );
}

/**
 * Antigravity CLI (`agy`) statusline: left key hint (`? for shortcuts` or `esc to cancel`) and
 * right-aligned `[mode · ]model · effort`. Ink's `justifyContent="space-between"` pads spaces
 * between the two columns on wide terminals and butts the two ANSI segments directly against each
 * other on a 38-column mobile pane (`? for shortcutsGemini 4 Argon · medium`). Splitting on either
 * the inter-column gap or that zero-gap boundary replaces both with a compact divider.
 */
const AGY_MODES = new Map([["auto", "Auto"], ["default", "Ask"], ["accept-edits", "Edit"], ["plan", "Plan"]]);
const AGY_FIELDS: { pattern: RegExp; icon: LucideIcon; hourglass?: boolean }[] = [
  { pattern: /^idle$/, icon: CircleCheck },
  { pattern: /^reviewing$/, icon: ListChecks },
  { pattern: /^error$/, icon: CircleAlert },
  { pattern: /^(?:thinking|working|tool_use|initializing|authenticating|merging)$/, icon: Hourglass, hourglass: true },
  { pattern: /^\? for shortcuts$/, icon: Keyboard },
  { pattern: /^esc to cancel$/, icon: CircleOff },
];

const AGY_MODE_RE = /^(?:auto|default|accept-edits|plan)$/;
const AGY_STATE_RE = /^(?:idle|reviewing|error|thinking|working|tool_use|initializing|authenticating|merging)$/;
const AGY_DROPPED_RE = /^(?:(?:Σin|in|Σout|out) \d+(?:\.\d+)?[km]?|cache \d+(?:\.\d+)?%)$/;
const AGY_VERSION_RE = /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const AGY_QUOTA_RE = /^(?:(Gemini|GEMINI MODELS|Claude\/GPT|CLAUDE AND GPT MODELS) )?((?:5h|7d) \d+(?:\.\d+)?%(?: ↻\S*)?(?: · (?:5h|7d) \d+(?:\.\d+)?%(?: ↻\S*)?)?)$/;
// The wide row prints `Model (High)` and the compact row prints `Model · medium`; the strip shows
// both the way Codex and Claude print theirs: `model effort`, lowercase and without parentheses or
// middle dots. Only a known level word qualifies, so a model whose own name ends in parentheses
// keeps them.
const AGY_MODEL_EFFORT_RE = /^(.*\S) (?:\((minimal|low|medium|high|xhigh|max)\)|·\s*(minimal|low|medium|high|xhigh|max))$/i;

interface QuotaWindow {
  /** The window's own name (`5h`, `7d`, `weekly`), absent when the label already names it. */
  period?: string;
  percent: string;
  /** Whether `percent` is what is LEFT (true) or what is USED (false), exactly as the agent said. */
  remaining: boolean;
  reset?: string;
}

function codexQuota(text: string): QuotaWindow | null {
  const match = /^(5h|weekly) (\d+(?:\.\d+)?%) (left|used)$/i.exec(text);
  if (!match?.[1] || !match[2] || !match[3] || Number.parseFloat(match[2]) > 100) return null;
  return { period: match[1].toLowerCase() === "weekly" ? "7d" : "5h", percent: match[2], remaining: match[3].toLowerCase() === "left" };
}

/** Native readings keep their place; account data fills only fields the statusline omitted. */
export function UsageFields({ usage, rows }: { usage: PaneUsage | undefined; rows: readonly StyledLine[] }) {
  const native = rows.map(lineText).join(" · ");
  const context = usage?.context !== undefined && !/(?:\b(?:ctx|context)[: ]+\d+(?:\.\d+)?%|\d+% context (?:left|used)|\[[█░]+\]\s*~?\d+(?:\.\d+)?%|[▓░]+\s+\d+%)/i.test(native);
  const limits = (usage?.limits ?? []).filter((limit) =>
    (limit.window === "5h" || limit.window === "7d") &&
    !(limit.window === "5h" ? /\b5h\s+\d+(?:\.\d+)?%/i : /\b(?:7d|weekly)\s+\d+(?:\.\d+)?%/i).test(native),
  );
  if (!context && limits.length === 0) return null;
  const detail = limits.map((limit) => `${limit.window} ${limit.used}% used${limit.resetsAt === undefined ? "" : ` · ${new Date(limit.resetsAt).toLocaleString()}`}`).join("; ");
  return (
    <span data-slot="statusline-usage" className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5">
      {context && <ContextField value={`${usage!.context}%`} remaining={false} />}
      {limits.length > 0 && <QuotaField text={detail} windows={limits.map((limit) => ({ period: limit.window, percent: `${limit.used}%`, remaining: false }))} />}
    </span>
  );
}

/**
 * One quota field, shared by every agent that prints usage windows: an optional group label, then per
 * window its period and remaining percentage, followed by reset times. The unit appears once per
 * group; each accessible window keeps its full label and reset time.
 */
function QuotaField({ text, label, labelSegment, windows, showUnit = true }: {
  text: string;
  label?: string;
  labelSegment?: AnsiSegment;
  windows: QuotaWindow[];
  showUnit?: boolean;
}) {
  useLocale();
  return (
    <span title={text} className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5 leading-none">
      {label && <span aria-hidden="true" style={labelSegment && styleFor(labelSegment)}>{label}</span>}
      {showUnit && <span aria-hidden="true" className="text-muted-foreground">{t("statusline.context.remainingShort")}</span>}
      {windows.map((window, index) => {
        const value = Number.parseFloat(window.percent);
        const left = window.remaining ? value : 100 - value;
        const shown = `${Number(left.toFixed(1))}%`;
        const name = [label, window.period, shown, t("statusline.context.remainingShort"), window.reset].filter(Boolean).join(" ");
        return (
          <span key={index} role="img" aria-label={name} title={name}
            className="inline-flex shrink-0 items-center gap-1">
            {window.period && <span aria-hidden="true" className="text-muted-foreground">{window.period}</span>}
            <span aria-hidden="true" className={left <= 10 ? "text-status-blocked" : left <= 20 ? "text-status-working" : "text-status-idle"}>
              {shown}
            </span>
          </span>
        );
      })}
      {windows.some((window) => window.reset) && (
        <span aria-hidden="true" className="text-muted-foreground">
          {windows.filter((window) => window.reset).map((window) => `${windows.length > 1 ? `${window.period} ` : ""}${window.reset}`).join(" · ")}
        </span>
      )}
    </span>
  );
}

function AgyField({ text, segments }: { text: string; segments: AnsiSegment[] }) {
  // Complete known fields only; custom labels retain their native text and ANSI styling.
  const mode = AGY_MODES.get(text);
  if (mode) return (
    <span role="img" aria-label={text} title={text} className="font-medium"
      style={segments[0] && styleFor(segments[0])}>{mode}</span>
  );
  for (const { pattern, icon, hourglass } of AGY_FIELDS) {
    const match = pattern.exec(text);
    if (match) return <StatusIconField text={text} segments={segments} icon={icon} value={match[1] ?? ""} hourglass={hourglass} />;
  }
  const quota = AGY_QUOTA_RE.exec(text);
  if (quota?.[2]) {
    const windows = quota[2].split(" · ").map((window): QuotaWindow => {
      const [period, percent, reset] = window.split(" ");
      return { period, percent: percent!, remaining: true, reset };
    });
    if (windows.every((window) => Number.parseFloat(window.percent) <= 100)) return (
      <QuotaField text={text} windows={windows} labelSegment={segments[0]}
        label={quota[1] && (quota[1].startsWith("G") ? "Gemini" : "Claude/GPT")} />
    );
  }
  const effort = AGY_MODEL_EFFORT_RE.exec(text);
  const rawLevel = effort?.[2] ?? effort?.[3];
  if (effort?.[1] && rawLevel) {
    const level = rawLevel.toLowerCase();
    const levelStart = effort[2] ? text.length - rawLevel.length - 1 : text.length - rawLevel.length;
    // `sliceSegments` returns fresh segment copies, so lowercasing them leaves the row untouched.
    const levelSegments = sliceSegments(segments, levelStart, levelStart + level.length);
    for (const segment of levelSegments) segment.text = segment.text.toLowerCase();
    return (
      <span className="inline-flex min-h-3.5 shrink-0 items-center" title={`${effort[1]} ${level}`}>
        <span>
          <StyledText segments={sliceSegments(segments, 0, effort[1].length)} />
          {" "}
          <StyledText segments={levelSegments} />
        </span>
      </span>
    );
  }
  return <ClaudeField text={text} segments={segments} />;
}

function orderAgyFields(raw: StatuslineField[]): StatuslineField[] {
  const items = raw.filter((item) => !AGY_DROPPED_RE.test(item.text));
  if (items.length >= 3 && AGY_MODE_RE.test(items[0]!.text) && AGY_STATE_RE.test(items[1]!.text)) {
    const [mode, state, model] = items;
    items.splice(0, 3, model!, mode!, state!);
  }
  const model = items.find((item) => !AGY_MODE_RE.test(item.text) && !AGY_STATE_RE.test(item.text))?.text ?? "";
  const activeQuota = /^Gemini\b/i.test(model) ? /^(?:Gemini|GEMINI MODELS) / : /^(?:Claude\b|gpt[- ])/i.test(model) ? /^(?:Claude\/GPT|CLAUDE AND GPT MODELS) / : null;
  items.sort((a, b) => {
    const rank = (text: string) => AGY_STATE_RE.test(text) ? -1 : fieldGroup(text);
    return rank(a.text) - rank(b.text) || (fieldGroup(a.text) === 1 && activeQuota
      ? Number(activeQuota.test(b.text)) - Number(activeQuota.test(a.text)) : 0);
  });
  const versionIndex = items.findIndex((item) => AGY_VERSION_RE.test(item.text));
  if (versionIndex !== -1 && versionIndex < items.length - 1) {
    const [version] = items.splice(versionIndex, 1);
    items.push(version!);
  }
  return items;
}

function AgyStatusline({ row, leading }: { row: StyledLine; leading?: ReactNode }) {
  let offset = 0;
  const rawFields: StatuslineField[] = [];
  for (const [index, part] of lineText(row)
    .split(/((?<=\S)\s{2,}(?=\S)|(?<=^(?:\? for shortcuts|esc to cancel))(?=\S))/i)
    .entries()) {
    const text = part.trim();
    const start = offset + (text ? part.indexOf(text) : 0);
    offset += part.length;
    if (!text || index % 2 === 1) continue;
    rawFields.push({ index, text, start });
  }
  const ordered = orderAgyFields(rawFields);
  const fields = ordered.map((field, position) => (
    <span key={field.index} className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5">
      {dividesFields(ordered[position - 1]?.text, field.text) && <StatuslineDivider />}
      <AgyField text={field.text} segments={sliceSegments(row.segments, field.start, field.start + field.text.length)} />
    </span>
  ));
  return (
    <div data-slot="agy-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {fields}
    </div>
  );
}

function FirstTokenField({ ms, divider = true }: { ms?: number; divider?: boolean }) {
  useLocale();
  if (ms === undefined || !Number.isSafeInteger(ms) || ms < 0) return null;
  const value = `${(ms / 1000).toFixed(1)}s`;
  const label = t("statusline.codex.firstToken", { value });
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {divider && <StatuslineDivider />}
      <span role="img" aria-label={label} title={label} className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none">
        <Timer aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25} />
        <span aria-hidden="true">{value}</span>
      </span>
    </span>
  );
}

function CodexModelButton({ label, onClick, disabledReason, expanded, switchable, children }: {
  label: string;
  onClick: () => void;
  disabledReason?: string;
  expanded: boolean;
  switchable: boolean;
  children: ReactNode;
}) {
  useLocale();
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      disabled={disabledReason !== undefined}
      aria-label={`${t("codexModel.openAria")}: ${label}`}
      aria-expanded={expanded}
      aria-controls="codex-model-recents"
      className="h-auto min-h-3.5 shrink-0 gap-0 border-0 p-0 has-[>svg]:px-0 text-[length:inherit] leading-none font-normal"
    >
      {children}
      <ChevronUp
        aria-hidden="true"
        className={cn("size-3 shrink-0 transition-[opacity,transform] motion-reduce:transition-none", expanded && "rotate-180", switchable ? "opacity-100" : "opacity-40")}
      />
    </Button>
  );
}

function HermesField({ segments, text, sessionModel }: { segments: AnsiSegment[]; text: string; sessionModel?: SessionModel }) {
  useLocale();
  const context = /^\[[█░]+\]\s*(~?\d+(?:\.\d+)?%)$/.exec(text);
  if (context?.[1] && Number.parseFloat(context[1].replace(/^~/, "")) <= 100) {
    return <ContextField value={context[1]} remaining={false} />;
  }
  const running = /^⏱ (.+)$/.exec(text);
  if (running?.[1]) {
    return (
      <StatusIconField
        text={t("statusline.hermes.elapsed", { value: running[1] })}
        segments={segments}
        icon={Hourglass}
        value=""
        hourglass
      />
    );
  }
  const idle = /^(?:✓|⏲) (.+)$/.exec(text);
  if (idle?.[1]) {
    const label = text.startsWith("✓") ? "statusline.hermes.idle" : "statusline.hermes.elapsed";
    return (
      <StatusIconField
        text={t(label, { value: idle[1] })}
        segments={segments}
        icon={CircleCheck}
        value=""
      />
    );
  }
  const branch = /^⎇\s+(.+)$/.exec(text);
  if (branch?.[1]) {
    return (
      <StatusIconField
        text={branch[1]}
        segments={sliceSegments(segments, text.indexOf(branch[1]), text.length)}
        icon={GitBranch}
        value={branch[1]}
      />
    );
  }
  const model = /^[⚕☤]\s+/.exec(text);
  if (model && sessionModel) {
    const visible = text.slice(model[0].length);
    const names = [sessionModel.model, (sessionModel.model.split("/").at(-1) ?? sessionModel.model).replace(/\.gguf$/, "")];
    const matches = names.some((name) => visible.endsWith("...") ? name.startsWith(visible.slice(0, -3)) : name === visible);
    if (matches) {
      const label = sessionModel.model;
      const ink = sliceSegments(segments, model[0].length, text.length)[0];
      return <span className="inline-flex min-h-3.5 shrink-0 items-center" title={label} style={ink && styleFor(ink)}>{label}</span>;
    }
  }
  return (
    <span className="inline-flex min-h-3.5 shrink-0 items-center leading-none" title={text}>
      <StyledText segments={model ? sliceSegments(segments, model[0].length, text.length) : segments} />
    </span>
  );
}

// Hermes separates fields with `│` (classic) or ` · ` (modern, v0.22.4), puts a conversation title
// after `  ─`, and in the modern layout right-aligns its key hints (`/ 命令 · @ 文件 · ! 终端`) after
// a wide gap. Both the classic session title and the modern key hints are dropped here.
const HERMES_SPLIT_RE = /(\s*│\s*|\s{2,}─(?:\s+.*)?$| · |\s{3,})/;
const HERMES_HINT_RE = /^[/@!] \S+$/;
// Token counts, uninitialized context bars, performance telemetry, session total duration, and cwd
// are dropped so Hermes shares the same compact statusline vocabulary as the other agents.
const HERMES_DROPPED_RE = /^(?:~?\d+(?:\.\d+)?[KkMm]?\/\d+(?:\.\d+)?[KkMm]?(?:\s|$)|(?:ctx|上下文) --|\[[█░]+\]\s*--|[◎◷↑] |(?:\d+[hms]\s*)+$|~(?:\/|$)|\/)/i;
// The provider quota segment (`TP 100.0%`, remaining) prints its cycle reset as its own ` · ` field.
const HERMES_QUOTA_RE = /^(TP) (\d+(?:\.\d+)?%)$/;
const HERMES_RESET_RE = /^↻\S.*$/;

/** Shared order: turn state, model, context, quota, then project details. */
function hermesRank(text: string): number {
  if (/^[⚕☤]\s/.test(text)) return 1;
  if (/^[✓⏱⏲] /.test(text)) return 0;
  if (/^\[[█░]+\]/.test(text)) return 2;
  if (/^⎇\s+/.test(text)) return 4;
  if (HERMES_QUOTA_RE.test(text)) return 3;
  return 5;
}

function HermesStatusline({ row, leading, sessionModel }: { row: StyledLine; leading?: ReactNode; sessionModel?: SessionModel }) {
  useLocale();
  const fields: (StatuslineField & { reset?: string })[] = [];
  let offset = 0;
  for (const [index, part] of lineText(row).split(HERMES_SPLIT_RE).entries()) {
    const text = part.trim();
    const start = offset + (text ? part.indexOf(text) : 0);
    offset += part.length;
    if (!text || index % 2 === 1 || HERMES_HINT_RE.test(text) || HERMES_DROPPED_RE.test(text)) continue;
    const previous = fields.at(-1);
    if (previous && !previous.reset && HERMES_RESET_RE.test(text) && HERMES_QUOTA_RE.test(previous.text)) {
      previous.reset = text;
      continue;
    }
    fields.push({ index, text, start });
  }
  const hasRunningState = fields.some((field) => field.text.startsWith("⏱ "));
  const hasPrimaryState = fields.some((field) => /^[⏱✓] /.test(field.text));
  const deduplicated = fields.filter((field) => !(hasPrimaryState && field.text.startsWith("⏲ ")) && !(hasRunningState && field.text.startsWith("✓ ")));
  const ordered = deduplicated.map((field, position) => ({ field, position, rank: hermesRank(field.text) }))
    .toSorted((a, b) => a.rank - b.rank || a.position - b.position)
    .map(({ field }) => field);
  return (
    <div data-slot="hermes-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {ordered.map((field, position) => {
        const segments = sliceSegments(row.segments, field.start, field.start + field.text.length);
        const quota = HERMES_QUOTA_RE.exec(field.text);
        return (
          <span key={field.index} className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5">
            {dividesFields(ordered[position - 1]?.text, field.text) && <StatuslineDivider />}
            {quota?.[1] && quota[2] && Number.parseFloat(quota[2]) <= 100
              ? <QuotaField text={field.reset ? `${field.text} · ${field.reset}` : field.text} label={quota[1]}
                labelSegment={segments[0]} windows={[{ percent: quota[2], remaining: true, reset: field.reset }]} />
              : <HermesField text={field.text} segments={segments} sessionModel={sessionModel} />}
          </span>
        );
      })}
    </div>
  );
}

type CodexStatuslineField = { index: number; text: string; start: number };

function isNativeCodexControlField(text: string): boolean {
  return /^Fast[ :](?:on|off)$/i.test(text) || /^Plan mode(?: \([^)]*\))?$/i.test(text);
}

function CodexControlledStatusline({
  row,
  leading,
  lastTurnFirstTokenMs,
  onModelClick,
  knownModels,
  modelSwitchable,
  modelExpanded,
  modelDisabledReason,
  codexControls,
  codexWarning,
}: {
  row: StyledLine;
  leading?: ReactNode;
  lastTurnFirstTokenMs?: number;
  onModelClick?: () => void;
  knownModels?: readonly string[];
  modelSwitchable: boolean;
  modelExpanded: boolean;
  modelDisabledReason?: string;
  codexControls: { plan: CodexControlProps; fast: CodexControlProps };
  codexWarning?: { disabledReason?: string; onClick: (count: number) => void };
}) {
  row = { ...row, segments: stripCodexPlanHint(row.segments) };
  const parts = lineText(row).split(/( \u00b7 |(?<=\S) {2,}(?=⚠ [1-9]\d* warnings?\b))/);
  const fields: CodexStatuslineField[] = [];
  let offset = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const text = part.trim();
    const start = offset + (text ? part.indexOf(text) : 0);
    offset += part.length;
    if (text && index % 2 === 0) fields.push({ index, text, start });
  }

  let model: { field: CodexStatuslineField; effort?: CodexStatuslineField } | undefined;
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    const parsed = parseCodexModelField(field.text, knownModels);
    if (!parsed) continue;
    const next = fields[index + 1];
    const joinEffort = parsed.effort === null && next?.index === field.index + 2 &&
      parseCodexStatuslineField(field.text, next.text, knownModels)?.effort != null;
    model = {
      field,
      effort: joinEffort ? next : undefined,
    };
    break;
  }

  const consumed = new Set([model?.field.index, model?.effort?.index]);
  const states = fields.filter((field) => /^(?:Ready|Working)$/.test(field.text));
  const rest = fields.filter((field) => !consumed.has(field.index) && !states.includes(field) && !isNativeCodexControlField(field.text));
  const nonVersionRest = rest.filter((field) => !CODEX_VERSION_RE.test(field.text))
    .toSorted((a, b) => fieldGroup(a.text) - fieldGroup(b.text));
  const versionRest = rest.filter((field) => CODEX_VERSION_RE.test(field.text));
  const content: ReactNode[] = states.map((field) => <CodexField key={field.index} text={field.text}
    segments={sliceSegments(row.segments, field.start, field.start + field.text.length)} />);

  if (model) {
    const fullText = model.effort ? `${model.field.text} ${model.effort.text}` : model.field.text;
    const modelContent = (
      <span>
        <StyledText segments={sliceSegments(row.segments, model.field.start, model.field.start + model.field.text.length)} />
        {model.effort && (
          <>
            {" "}
            <StyledText segments={sliceSegments(row.segments, model.effort.start, model.effort.start + model.effort.text.length)} />
          </>
        )}
      </span>
    );
    if (onModelClick) {
      content.push(
        <span key="model" className="inline-flex shrink-0 items-center gap-1" title={modelDisabledReason}>
          <CodexModelButton label={fullText} onClick={onModelClick} disabledReason={modelDisabledReason}
            expanded={modelExpanded} switchable={modelSwitchable}>
            {modelContent}
          </CodexModelButton>
        </span>,
      );
    } else {
      content.push(<span key="model" className="inline-flex min-h-3.5 shrink-0 items-center" title={fullText}>{modelContent}</span>);
    }
  }

  content.push(<CodexModeToggle key="plan" mode="plan" {...codexControls.plan} />);
  content.push(<CodexModeToggle key="fast" mode="fast" {...codexControls.fast} />);
  let previous = "Ready";
  for (let index = 0; index < nonVersionRest.length; index++) {
    const field = nonVersionRest[index]!;
    const quotaUnit = codexQuota(previous) === null;
    if (dividesFields(previous, field.text)) content.push(<StatuslineDivider key={`divider-${field.index}`} />);
    previous = field.text;
    const next = nonVersionRest[index + 1];
    const count = next?.index === field.index + 2
      ? codexWarningCount(`${field.text} · ${next.text}`) : null;
    if (count !== null && codexWarning) {
      const label = `${field.text} · ${next!.text}`;
      content.push(
        <Button key={field.index} type="button" variant="ghost" title={label}
          aria-label={label} disabled={codexWarning.disabledReason !== undefined}
          onClick={() => codexWarning.onClick(count)}
          className="h-5 w-auto shrink-0 gap-0.5 rounded-sm border-0 px-1 py-0 text-[length:inherit] font-normal leading-none text-amber-400 hover:bg-white/10 has-[>svg]:px-1">
          <TriangleAlert aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
          {count}
        </Button>,
      );
      index++;
      continue;
    }
    content.push(
      <CodexField
        key={field.index}
        text={field.text}
        quotaUnit={quotaUnit}
        segments={sliceSegments(row.segments, field.start, field.start + field.text.length)}
      />,
    );
  }
  const hasFirstToken = lastTurnFirstTokenMs !== undefined && Number.isSafeInteger(lastTurnFirstTokenMs) && lastTurnFirstTokenMs >= 0;
  const versionContent = versionRest.map((field, index) => (
    <span key={field.index} className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5">
      {index === 0 && !hasFirstToken && dividesFields(previous, field.text) && <StatuslineDivider />}
      <CodexField
        text={field.text}
        segments={sliceSegments(row.segments, field.start, field.start + field.text.length)}
      />
    </span>
  ));

  return (
    <div data-slot="codex-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {content}
      <FirstTokenField ms={lastTurnFirstTokenMs} divider={fieldGroup(previous) !== 2} />
      {versionContent}
    </div>
  );
}

/**
 * Claude's permission mode, tappable: one tap cycles it the way the terminal's own `shift+tab` does.
 *
 * The row Claude prints is `⏵⏵ bypass permissions on (shift+tab to cycle) · ← 1 agent`. The mode is
 * the button; the parenthetical is REPLACED by the two keys it names as text glyphs in the row's own
 * font — `(⇧⇥)`, the same arrows the terminal paints beside it — so the hint costs four characters
 * instead of twenty of prose on a statusline that has to scroll on a phone.
 *
 * The button is drawn even when the hint is absent (`⏸ manual mode on`): the affordance is OURS, not
 * the terminal's, and a mode with no hint is no less switchable.
 */
function ClaudeModeButton({
  field,
  busy,
  disabledReason,
  onClick,
}: {
  field: ClaudeModeField;
  busy: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  useLocale();
  const label = lineText(field.mode).trim();
  // Busy is NOT a refusal — the key still goes out while Claude works, and Claude decides what it
  // means. It only swaps the Tab glyph for the spinner so a slow cycle has visible motion; the
  // refusal that greys the button is `disabledReason` alone.
  const disabled = disabledReason !== undefined;
  return (
    <span className="inline-flex min-h-3.5 shrink-0 items-center" title={disabledReason}>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        // The accessible name carries the mode and what the tap will do; the icons are decoration
        // for the eye, and a screen reader gets the sentence instead of two arrow glyphs.
        aria-label={t("claudeMode.title", { mode: label })}
        aria-describedby={undefined}
        onClick={onClick}
        className="h-auto min-h-3.5 shrink-0 gap-1 rounded-sm border-0 px-0 py-0 text-[length:inherit] font-normal leading-none hover:bg-white/10"
      >
        <span className="whitespace-pre">
          <StyledText segments={field.mode.segments} />
        </span>
        <span aria-hidden="true" className="shrink-0 opacity-70">
          (⇧{busy
            ? <Loader2 className="inline-block size-[12px] shrink-0 animate-spin align-[-2px] motion-reduce:animate-none" strokeWidth={2.25} />
            : "⇥"})
        </span>
      </Button>
    </span>
  );
}

export function StatuslineRow({
  agent,
  row,
  leading,
  sessionModel,
  lastTurnFirstTokenMs,
  onModelClick,
  knownModels,
  modelSwitchable = false,
  modelExpanded = false,
  modelDisabledReason,
  codexControls,
  codexWarning,
  claudeMode,
}: {
  agent?: string;
  row: StyledLine;
  leading?: ReactNode;
  sessionModel?: SessionModel;
  lastTurnFirstTokenMs?: number;
  onModelClick?: () => void;
  knownModels?: readonly string[];
  /** Is there anything to switch TO — a used pair other than the one on screen? */
  modelSwitchable?: boolean;
  modelExpanded?: boolean;
  modelDisabledReason?: string;
  codexControls?: { plan: CodexControlProps; fast: CodexControlProps };
  codexWarning?: { disabledReason?: string; onClick: (count: number) => void };
  /** Claude's statusline mode, when this pane shows one and the app may cycle it. */
  claudeMode?: { busy: boolean; disabledReason?: string; onClick: () => void };
}) {
  useLocale();
  // Claude's mode row is the one place on that statusline a phone can drive. Only the mode FIELD is
  // rebuilt; everything the terminal painted around it — the rest of the row, its own
  // separators — is rendered from the capture, so a row without a mode is untouched.
  const claudeField = agent === "claude" && claudeMode ? modeFieldOf(row) : null;
  if (claudeField && claudeMode) {
    return (
      <div data-slot="claude-statusline" className={ROW_CLASS}>
        {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
        <span className="inline-flex min-w-max shrink-0 items-center">
          <ClaudeModeButton field={claudeField} {...claudeMode} />
          <span className="whitespace-pre"><StyledText segments={claudeField.rest.segments} /></span>
        </span>
      </div>
    );
  }

  if (agent === "claude") {
    const text = lineText(row);
    // Claude's own right-aligned aside (`new task? …`, `Ctrl+Y …`): the actions belt carries it as a
    // tip icon, so the strip draws NOTHING for it rather than a raw, deeply indented row.
    if (isClaudeAsideRow(text)) return null;
    // A pipe-separated statusline. The `new task?` sentence may also be appended to it as a field,
    // which ClaudeStatusline drops for the same reason.
    if (/\s\|\s/.test(text)) return <ClaudeStatusline row={row} leading={leading} />;
  }
  if (agent === "cursor") return <CursorStatusline row={row} leading={leading} />;
  if (agent === "agy" || agent === "antigravity") return <AgyStatusline row={row} leading={leading} />;
  if (agent === "hermes") return <HermesStatusline row={row} leading={leading} sessionModel={sessionModel} />;
  if (agent !== "codex") {
    return (
      <div data-slot="statusline-row" className={ROW_CLASS}>
        {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
        <span className="inline-flex min-w-max shrink-0 items-center">
          <StyledText segments={row.segments} />
        </span>
      </div>
    );
  }

  if (codexControls) {
    return (
      <CodexControlledStatusline
        row={row}
        leading={leading}
        lastTurnFirstTokenMs={lastTurnFirstTokenMs}
        onModelClick={onModelClick}
        knownModels={knownModels}
        modelSwitchable={modelSwitchable}
        modelExpanded={modelExpanded}
        modelDisabledReason={modelDisabledReason}
        codexControls={codexControls}
        codexWarning={codexWarning}
      />
    );
  }

  // Split the joined text, not each ANSI span: a field's label and value can have different paint.
  // Keep unknown fields verbatim and scroll long rows rather than dropping their final fields.
  const fields: StatuslineField[] = [];
  let offset = 0;
  for (const [index, part] of lineText(row).split(/( \u00b7 )/).entries()) {
    const text = part.trim();
    const start = offset + (text ? part.indexOf(text) : 0);
    offset += part.length;
    if (text && index % 2 === 0) fields.push({ index, text, start });
  }
  const nonVersionFields = fields.filter((field) => !CODEX_VERSION_RE.test(field.text))
    .toSorted((a, b) => {
      const rank = (text: string) => /^(?:Ready|Working)$/.test(text) ? -1 : fieldGroup(text);
      return rank(a.text) - rank(b.text);
    });
  const versionFields = fields.filter((field) => CODEX_VERSION_RE.test(field.text));
  const content: ReactNode[] = [];
  let modelShown = false;
  let previous: string | undefined;
  for (let i = 0; i < nonVersionFields.length; i++) {
    const field = nonVersionFields[i]!;
    const segments = sliceSegments(row.segments, field.start, field.start + field.text.length);
    const model = onModelClick && !modelShown ? parseCodexModelField(field.text, knownModels) : null;
    let node: ReactNode;
    if (model && onModelClick) {
      modelShown = true;
      const next = nonVersionFields[i + 1];
      const joinEffort = model.effort === null && next?.index === field.index + 2 &&
        parseCodexStatuslineField(field.text, next.text, knownModels)?.effort != null;
      if (joinEffort) i++;
      node = (
        <span className="inline-flex shrink-0 items-center gap-1" title={modelDisabledReason}>
          <CodexModelButton label={joinEffort ? `${field.text} ${next!.text}` : field.text} onClick={onModelClick}
            disabledReason={modelDisabledReason} expanded={modelExpanded} switchable={modelSwitchable}>
            <span>
              <StyledText segments={segments} />
              {joinEffort && (
                <>
                  {" "}
                  <StyledText segments={sliceSegments(row.segments, next!.start, next!.start + next!.text.length)} />
                </>
              )}
            </span>
          </CodexModelButton>
        </span>
      );
    } else {
      node = <CodexField text={field.text} segments={segments} quotaUnit={previous === undefined || codexQuota(previous) === null} />;
    }
    content.push(
      <span key={field.index} className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5">
        {dividesFields(previous, field.text) && <StatuslineDivider />}
        {node}
      </span>,
    );
    previous = field.text;
  }
  const hasFirstToken = lastTurnFirstTokenMs !== undefined && Number.isSafeInteger(lastTurnFirstTokenMs) && lastTurnFirstTokenMs >= 0;
  const versionContent = versionFields.map((field, index) => (
    <span key={field.index} className="inline-flex min-h-3.5 shrink-0 items-center gap-1.5">
      {index === 0 && !hasFirstToken && dividesFields(previous, field.text) && <StatuslineDivider />}
      <CodexField
        text={field.text}
        segments={sliceSegments(row.segments, field.start, field.start + field.text.length)}
      />
    </span>
  ));
  return (
    <div data-slot="codex-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {content}
      <FirstTokenField ms={lastTurnFirstTokenMs} divider={previous !== undefined && fieldGroup(previous) !== 2} />
      {versionContent}
    </div>
  );
}
