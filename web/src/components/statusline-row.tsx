import {
  CalendarDays,
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
  ZapOff,
  type LucideIcon,
} from "lucide-react";

import type { AnsiSegment } from "@/lib/ansi";
import { lineText, type StyledLine } from "@/lib/blocks";
import { styleFor } from "@/components/mirror-space";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// These are display-only matches over complete fields, never composer recognition rules.
// Capture the value to keep it visible; the full terminal label remains the accessible name.
const CODEX_FIELDS: { pattern: RegExp; icon: LucideIcon }[] = [
  { pattern: /^(?:Context|Ctx) (\d+%)$/, icon: Gauge },
  { pattern: /^Ready$/, icon: CircleCheck },
  { pattern: /^Working$/, icon: Hourglass },
  { pattern: /^Approve(?: (?:for )?me)?$/, icon: ShieldCheck },
  { pattern: /^Fast[ :]on$/, icon: Zap },
  { pattern: /^Fast[ :]off$/, icon: ZapOff },
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

function ContextField({ segments, value, remaining }: {
  segments: AnsiSegment[];
  value: string;
  remaining: boolean;
}) {
  const { locale } = useLocale();
  const percent = Number.parseInt(value, 10);
  const used = remaining ? 100 - percent : percent;
  const label = t(remaining ? "statusline.context.remainingAria" : "statusline.context.usedAria", { percent: value });
  const shortLabel = t(remaining ? "statusline.context.remainingShort" : "statusline.context.usedShort");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex min-h-3.5 shrink-0 items-center gap-0.5 leading-none"
    >
      <span
        aria-hidden="true"
        data-status-icon="context"
        data-value={percent}
        data-used={used}
        className="size-[12px] shrink-0 rounded-full"
        style={{
          // This strip is inverted in light mode: keep ring paint in the mirror's dark space.
          color: used >= 95 ? "var(--ansi-9)" : used >= 80 ? "var(--ansi-11)" : "#fafafa",
          background: `conic-gradient(currentColor ${percent}%, rgb(255 255 255 / 22%) 0)`,
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
        }}
      />
      <span
        aria-hidden="true"
        className={cn("inline-flex items-center gap-0.5", ["zh", "ja", "ko"].includes(locale) && "flex-row-reverse")}
      >
        <span className="inline-block w-[4ch] text-right tabular-nums">
          <StyledText segments={segments} />
        </span>
        <span>{shortLabel}</span>
      </span>
    </span>
  );
}

function CodexField({ segments, text }: { segments: AnsiSegment[]; text: string }) {
  // Only explicit units are safe to label; bare legacy "Ctx N%" stays ambiguous.
  const context = /^(?:Context|Ctx) (\d+%) (left|used)$/.exec(text);
  if (context?.[1] && Number.parseInt(context[1], 10) <= 100) {
    const value = context[1];
    const start = text.indexOf(value);
    return (
      <ContextField
        segments={sliceSegments(segments, start, start + value.length)}
        value={value}
        remaining={context[2] === "left"}
      />
    );
  }
  for (const { pattern, icon: Icon } of CODEX_FIELDS) {
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
          style={segments[0] && styleFor(segments[0])}
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

export function StatuslineRow({ agent, row }: { agent?: string; row: StyledLine }) {
  if (agent !== "codex") {
    return <div className="truncate"><StyledText segments={row.segments} /></div>;
  }

  // Split the joined text, not each ANSI span: a field's label and value can have different paint.
  // Keep unknown fields verbatim and scroll long rows rather than dropping their final fields.
  let offset = 0;
  return (
    <div
      data-slot="codex-statusline"
      className="flex min-h-3.5 items-center gap-1.5 overflow-x-auto whitespace-nowrap leading-none tabular-nums [scrollbar-width:none]"
    >
      {lineText(row).split(" \u00b7 ").map((part, i) => {
        const text = part.trim();
        const start = offset + part.indexOf(text);
        offset += part.length + 3;
        if (!text) return null;
        return (
          <CodexField
            key={i}
            text={text}
            segments={sliceSegments(row.segments, start, start + text.length)}
          />
        );
      })}
    </div>
  );
}
