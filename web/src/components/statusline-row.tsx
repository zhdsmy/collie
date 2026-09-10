import {
  CalendarDays,
  Clock,
  Database,
  CircleAlert,
  CircleCheck,
  CircleOff,
  Gauge,
  Hourglass,
  ListChecks,
  Pause,
  ShieldCheck,
  Target,
  Timer,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { AnsiSegment } from "@/lib/ansi";
import type { SessionModel } from "@/lib/types";
import { lineText, type StyledLine } from "@/lib/blocks";
import { styleFor } from "@/components/mirror-space";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// These are display-only matches over complete fields, never composer recognition rules.
// Capture the value to keep it visible; the full terminal label remains the accessible name.
const CODEX_FIELDS: { pattern: RegExp; icon: LucideIcon; fill?: "currentColor"; color?: string }[] = [
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
    <span key={i} style={styleFor(segment)}>{segment.text}</span>
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
    <span className="inline-flex min-h-3.5 shrink-0 items-center leading-normal" title={text}>
      <span><StyledText segments={segments} /></span>
    </span>
  );
}

const ROW_CLASS =
  "flex min-w-0 min-h-3.5 items-center gap-1.5 overflow-x-auto overscroll-x-contain whitespace-nowrap leading-none tabular-nums [scrollbar-width:none]";

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
  const model = /^⚕\s+/.exec(text);
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

export function StatuslineRow({
  agent,
  row,
  leading,
  sessionModel,
}: {
  agent?: string;
  row: StyledLine;
  leading?: ReactNode;
  sessionModel?: SessionModel;
}) {
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

  // Split the joined text, not each ANSI span: a field's label and value can have different paint.
  // Keep unknown fields verbatim and scroll long rows rather than dropping their final fields.
  let offset = 0;
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
        if (!text || i % 2 === 1) return null;
        return (
          <Field
            key={i}
            text={text}
            segments={sliceSegments(row.segments, start, start + text.length)}
            sessionModel={sessionModel}
          />
        );
      })}
    </div>
  );
}
