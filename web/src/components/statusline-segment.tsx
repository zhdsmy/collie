import { CircleCheck, Hourglass, ListChecks, ShieldCheck, Zap } from "lucide-react";

import type { AnsiSegment } from "@/lib/ansi";
import { styleFor } from "@/components/mirror-space";

interface StatuslineSegmentProps {
  agent: string | undefined;
  segment: AnsiSegment;
}

const CODEX_STATUS_TOKEN =
  /(Ctx \d+%|Approve|Fast:(?:on|off)|Tasks \d+\/\d+|Ready|Working)/g;
const EXACT_CODEX_STATUS_TOKEN =
  /^(?:Ctx \d+%|Approve|Fast:(?:on|off)|Tasks \d+\/\d+|Ready|Working)$/;
const CONTEXT_TOKEN = /^Ctx (\d+%)$/;
const TASKS_TOKEN = /^Tasks (\d+\/\d+)$/;

function CodexStatusToken({ token }: { token: string }) {
  const context = CONTEXT_TOKEN.exec(token);
  if (context) {
    const value = context[1]!;
    const percent = Math.min(100, Math.max(0, Number.parseInt(value, 10)));
    return (
      <span
        className="inline-flex items-center gap-0.5 align-[-0.125em]"
        aria-label={`Context ${value} left`}
        title={`Context ${value} left`}
      >
        <span
          aria-hidden="true"
          className="size-[1em] shrink-0 rounded-full"
          data-status-icon="context"
          data-value={percent}
          style={{
            background: `conic-gradient(currentColor ${percent}%, rgb(255 255 255 / 22%) 0)`,
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 0)",
          }}
        />
        <span aria-hidden="true">{value}</span>
      </span>
    );
  }

  if (token === "Ready" || token === "Working") {
    const working = token === "Working";
    return (
      <span
        className="inline-flex items-center align-[-0.125em]"
        aria-label={token}
        title={token}
        data-status-icon="activity"
        data-state={working ? "working" : "ready"}
      >
        {working ? (
          <Hourglass
            aria-hidden="true"
            className="size-[1em] motion-safe:animate-pulse"
            strokeWidth={2.25}
          />
        ) : (
          <CircleCheck aria-hidden="true" className="size-[1em]" strokeWidth={2.25} />
        )}
      </span>
    );
  }

  if (token === "Approve") {
    return (
      <span
        className="inline-flex items-center align-[-0.125em]"
        aria-label="Approve for me"
        title="Approve for me"
      >
        <ShieldCheck aria-hidden="true" className="size-[1em]" strokeWidth={2.25} />
      </span>
    );
  }

  if (token === "Fast:on" || token === "Fast:off") {
    const on = token === "Fast:on";
    return (
      <span
        className="inline-flex items-center align-[-0.125em]"
        aria-label={on ? "Fast on" : "Fast off"}
        title={on ? "Fast on" : "Fast off"}
        data-status-icon="fast"
        data-state={on ? "on" : "off"}
      >
        <Zap
          aria-hidden="true"
          className="size-[1em]"
          fill={on ? "currentColor" : "none"}
          strokeWidth={2.25}
        />
      </span>
    );
  }

  const tasks = TASKS_TOKEN.exec(token);
  if (tasks) {
    const value = tasks[1]!;
    return (
      <span
        className="inline-flex items-center gap-0.5 align-[-0.125em]"
        aria-label={`Tasks ${value}`}
        title="Tasks"
      >
        <ListChecks aria-hidden="true" className="size-[1em]" strokeWidth={2.25} />
        <span aria-hidden="true">{value}</span>
      </span>
    );
  }

  return token;
}

export function StatuslineSegment({ agent, segment }: StatuslineSegmentProps) {
  if (agent !== "codex") {
    return <span style={styleFor(segment, agent)}>{segment.text}</span>;
  }

  return (
    <span style={styleFor(segment, agent)}>
      {segment.text.split(CODEX_STATUS_TOKEN).map((part, index) =>
        EXACT_CODEX_STATUS_TOKEN.test(part) ? (
          <CodexStatusToken key={index} token={part} />
        ) : (
          part
        ),
      )}
    </span>
  );
}
