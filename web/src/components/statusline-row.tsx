import {
  ChevronUp,
  CalendarDays,
  Clock,
  Database,
  CircleAlert,
  CircleCheck,
  CircleOff,
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
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AnsiSegment } from "@/lib/ansi";
import type { SessionModel } from "@/lib/types";
import { lineText, type StyledLine } from "@/lib/blocks";
import { segmentStyle, styleFor } from "@/components/mirror-space";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CodexModeToggle, type CodexModeToggleProps } from "@/components/codex-mode-toggle";
import { parseCodexModelField, parseCodexStatuslineField } from "@/lib/harness/codex/model-field";
import { modeFieldOf, type ClaudeModeField } from "@/lib/harness/claude/mode";
import { CLAUDE_NEW_TASK_HINT } from "@/lib/harness/claude/chrome";

// These are display-only matches over complete fields, never composer recognition rules.
// Capture the value to keep it visible; the full terminal label remains the accessible name.
const CODEX_FIELDS: { pattern: RegExp; icon: LucideIcon; fill?: "currentColor"; color?: string }[] = [
  // ponytail: bare TUI fields have no type; custom branch names need upstream field metadata.
  { pattern: /^(main|master|develop|development|trunk|(?:feat|feature|fix|bugfix|hotfix|release|chore|refactor|test|docs)\/\S+)$/, icon: GitBranch },
  { pattern: /^(?:[Bb]ranch[: ]+|git[: ]+|\s+)(\S+)$/, icon: GitBranch },
  { pattern: /^(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/, icon: Tag },
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
  const label = t(remaining ? "statusline.context.remainingAria" : "statusline.context.usedAria", { percent: value });
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
        data-value={percent}
        data-used={used}
        className="size-[12px] shrink-0 rounded-full"
        style={{
          background: `conic-gradient(currentColor ${used}%, rgb(255 255 255 / 22%) 0)`,
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
        }}
      />
      <span aria-hidden="true" className="inline-block min-w-[4ch] text-right tabular-nums">
        {value}
      </span>
    </span>
  );
}

function CodexField({ segments, text }: { segments: AnsiSegment[]; text: string }) {
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
  const Icon = /^(?:main|master|develop|development|trunk|(?:feat|feature|fix|bugfix|hotfix|release|chore|refactor|test|docs)\/\S+)$/.test(text)
    ? GitBranch
    : /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(text) ? Tag : null;
  return (
    <span className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none" title={text}>
      {Icon && <Icon aria-hidden="true" className="size-[12px] shrink-0" strokeWidth={2.25} />}
      <span><StyledText segments={segments} /></span>
    </span>
  );
}

// Horizontal overflow also clips vertically. Keep glyph breathing room INSIDE the scroller;
// padding on the outer status strip cannot protect a font's ascenders or descenders here.
const ROW_CLASS =
  "flex min-w-0 min-h-3.5 items-center gap-1.5 overflow-x-auto overscroll-x-contain whitespace-nowrap py-0.5 leading-none tabular-nums [scrollbar-width:none]";

type CodexControlProps = Omit<CodexModeToggleProps, "mode">;

function StatuslineDivider() {
  return <span aria-hidden="true" className="h-3 w-px shrink-0 bg-white/25" />;
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
  const fields: ReactNode[] = [];
  for (const [index, part] of lineText(row).split(/(\s+\|\s+|(?<=\S)\s{2,}(?=\S))/).entries()) {
    const text = part.trim();
    const start = offset + part.indexOf(text);
    offset += part.length;
    if (!text || index % 2 === 1) continue;
    if (CLAUDE_NEW_TASK_HINT.test(text)) continue;
    fields.push(
      <span key={index} className="inline-flex shrink-0 items-center gap-1.5">
        {fields.length > 0 && <StatuslineDivider />}
        <ClaudeField text={text} segments={sliceSegments(row.segments, start, start + text.length)} />
      </span>,
    );
  }
  return (
    <div data-slot="claude-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {fields}
    </div>
  );
}

function FirstTokenField({ ms }: { ms?: number }) {
  useLocale();
  if (ms === undefined || !Number.isSafeInteger(ms) || ms < 0) return null;
  const value = `${(ms / 1000).toFixed(1)}s`;
  const label = t("statusline.codex.firstToken", { value });
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <StatuslineDivider />
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
  const fields = [
    { pattern: /^◎ (.+)$/, icon: Database, label: "statusline.hermes.cache" },
    { pattern: /^◷ (.+)$/, icon: Timer, label: "statusline.hermes.latency" },
    { pattern: /^↑ (.+)$/, icon: Gauge, label: "statusline.hermes.speed" },
    { pattern: /^[⏱⏲] (.+)$/, icon: Hourglass, label: "statusline.hermes.elapsed" },
    { pattern: /^✓ (.+)$/, icon: CircleCheck, label: "statusline.hermes.idle" },
    { pattern: /^((?:\d+[hms]\s*)+)$/, icon: Clock, label: "statusline.hermes.duration" },
  ] as const;
  for (const { pattern, icon: Icon, label } of fields) {
    const value = pattern.exec(text)?.[1];
    if (!value) continue;
    const name = t(label, { value });
    const start = text.indexOf(value);
    return (
      <span role="img" aria-label={name} title={name} className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none">
        <Icon
          aria-hidden="true"
          className={cn("size-[12px] shrink-0", text.startsWith("⏱") && "motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]")}
          strokeWidth={2.25}
          style={segments[0] && styleFor(segments[0])}
        />
        <span aria-hidden="true"><StyledText segments={sliceSegments(segments, start, start + value.length)} /></span>
      </span>
    );
  }
  const model = /^[⚕☤]\s+/.exec(text);
  if (model && sessionModel) {
    const visible = text.slice(model[0].length);
    const names = [sessionModel.model, (sessionModel.model.split("/").at(-1) ?? sessionModel.model).replace(/\.gguf$/, "")];
    const matches = names.some((name) => visible.endsWith("...") ? name.startsWith(visible.slice(0, -3)) : name === visible);
    if (matches) {
      const label = sessionModel.model + (sessionModel.reasoningEffort ? ` ${sessionModel.reasoningEffort}` : "");
      const ink = sliceSegments(segments, model[0].length, text.length)[0];
      return <span className="inline-flex min-h-3.5 shrink-0 items-center" title={label} style={ink && styleFor(ink)}>{label}</span>;
    }
  }
  return (
    <span className="inline-flex min-h-3.5 shrink-0 items-center leading-normal" title={text}>
      <StyledText segments={model ? sliceSegments(segments, model[0].length, text.length) : segments} />
    </span>
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
}) {
  const parts = lineText(row).split(/( \u00b7 )/);
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
  const rest = fields.filter((field) => !consumed.has(field.index) && !isNativeCodexControlField(field.text));
  const content: ReactNode[] = [];

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

  if (model) content.push(<StatuslineDivider key="model-plan" />);
  content.push(<CodexModeToggle key="plan" mode="plan" {...codexControls.plan} />);
  content.push(<StatuslineDivider key="plan-fast" />);
  content.push(<CodexModeToggle key="fast" mode="fast" {...codexControls.fast} />);
  for (const field of rest) {
    content.push(<StatuslineDivider key={`divider-${field.index}`} />);
    content.push(
      <CodexField
        key={field.index}
        text={field.text}
        segments={sliceSegments(row.segments, field.start, field.start + field.text.length)}
      />,
    );
  }

  return (
    <div data-slot="codex-statusline" className={ROW_CLASS}>
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {content}
      <FirstTokenField ms={lastTurnFirstTokenMs} />
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
    // Claude's own new-task sentence, alone on its own notification row (2.1.278): the actions belt
    // carries it as a tip icon, so the strip draws NOTHING for it rather than an empty row.
    if (CLAUDE_NEW_TASK_HINT.test(text.trim())) return null;
    // A pipe-separated statusline. The hint may also be appended to it as a field, which
    // ClaudeStatusline drops for the same reason.
    if (/\s\|\s/.test(text)) return <ClaudeStatusline row={row} leading={leading} />;
  }
  if (agent !== "codex" && agent !== "hermes") {
    return (
      <div data-slot="statusline-row" className={ROW_CLASS}>
        {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
        <span className="inline-flex min-w-max shrink-0 items-center">
          <StyledText segments={row.segments} />
        </span>
      </div>
    );
  }

  if (agent === "codex" && codexControls) {
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
      />
    );
  }

  // Split the joined text, not each ANSI span: a field's label and value can have different paint.
  // Keep unknown fields verbatim and scroll long rows rather than dropping their final fields.
  let offset = 0;
  let groupedEffortIndex = -1;
  const Field = agent === "hermes" ? HermesField : CodexField;
  const parts = agent === "hermes"
    ? lineText(row).split(/(\s*│\s*|\s{2,}─\s*)/)
    : lineText(row).split(/( \u00b7 )/);
  return (
    <div
      data-slot={agent === "hermes" ? "hermes-statusline" : "codex-statusline"}
      className={ROW_CLASS}
    >
      {leading !== undefined && <span data-slot="statusline-target" className="shrink-0">{leading}</span>}
      {parts.map((part, i) => {
        const text = part.trim();
        const start = offset + part.indexOf(text);
        offset += part.length;
        if (!text || i % 2 === 1 || i === groupedEffortIndex) return null;
        const model = agent === "codex" && onModelClick ? parseCodexModelField(text, knownModels) : null;
        if (model && onModelClick) {
          const nextPart = parts[i + 2] ?? "";
          const next = nextPart.trim();
          const joinEffort = model.effort === null && parseCodexStatuslineField(text, next, knownModels)?.effort != null;
          if (joinEffort) groupedEffortIndex = i + 2;
          const effortStart = offset + (parts[i + 1]?.length ?? 0) + nextPart.indexOf(next);
          return (
            <span key={i} className="inline-flex shrink-0 items-center gap-1" title={modelDisabledReason}>
              <CodexModelButton label={joinEffort ? `${text} ${next}` : text} onClick={onModelClick}
                disabledReason={modelDisabledReason} expanded={modelExpanded} switchable={modelSwitchable}>
                <span>
                  <StyledText segments={sliceSegments(row.segments, start, start + text.length)} />
                  {joinEffort && (
                    <>
                      {" "}
                      <StyledText segments={sliceSegments(row.segments, effortStart, effortStart + next.length)} />
                    </>
                  )}
                </span>
              </CodexModelButton>
              {parts[i + (joinEffort ? 4 : 2)]?.trim() && (
                <span aria-hidden="true" className="h-3 w-px shrink-0 bg-white/25" />
              )}
            </span>
          );
        }
        return (
          <Field
            key={i}
            text={text}
            segments={sliceSegments(row.segments, start, start + text.length)}
            sessionModel={sessionModel}
          />
        );
      })}
      {agent === "codex" && <FirstTokenField ms={lastTurnFirstTokenMs} />}
    </div>
  );
}
