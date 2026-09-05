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

// These are display-only matches over complete fields, never composer recognition rules.
// Capture the value to keep it visible; the full terminal label remains the accessible name.
const CODEX_FIELDS: { pattern: RegExp; icon: LucideIcon }[] = [
  { pattern: /^(?:Context|Ctx) (\d+%(?: used)?)(?: left)?$/, icon: Gauge },
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

function CodexField({ segments, text }: { segments: AnsiSegment[]; text: string }) {
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
        className="inline-flex h-3.5 shrink-0 items-center gap-0.5"
      >
        <Icon
          aria-hidden="true"
          className="size-[11px] shrink-0"
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
    <span className="shrink-0" title={text}>
      <StyledText segments={segments} />
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
      className="flex min-h-3.5 items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none]"
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
