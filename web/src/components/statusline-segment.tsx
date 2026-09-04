import {
  CircleAlert,
  CircleCheck,
  CircleOff,
  Gauge,
  Hourglass,
  ListChecks,
  Pause,
  ShieldCheck,
  Target,
  Zap,
} from "lucide-react";

import { styleFor } from "@/components/mirror-space";
import type { AnsiSegment } from "@/lib/ansi";

interface StatuslineSegmentProps {
  agent: string | undefined;
  segment: AnsiSegment;
}

const CODEX_STATUS_TOKEN =
  /(Ctx \d+%|Approve|Fast:(?:on|off)|Tasks \d+\/\d+|Ready|Working|Goal:(?:active|paused|blocked|usage|budget|abandoned|done))/g;
const EXACT_CODEX_STATUS_TOKEN =
  /^(?:Ctx \d+%|Approve|Fast:(?:on|off)|Tasks \d+\/\d+|Ready|Working|Goal:(?:active|paused|blocked|usage|budget|abandoned|done))$/;
const CONTEXT_TOKEN = /^Ctx (\d+%)$/;
const TASKS_TOKEN = /^Tasks (\d+\/\d+)$/;
const GOAL_TOKEN = /^Goal:(active|paused|blocked|usage|budget|abandoned|done)$/;
const GOAL_LABELS = {
  active: "Pursuing goal",
  paused: "Goal paused",
  blocked: "Goal stalled",
  usage: "Goal hit usage limits",
  budget: "Goal unmet",
  abandoned: "Goal abandoned",
  done: "Goal achieved",
} as const;
type GoalDisplayState = keyof typeof GOAL_LABELS;

function isGoalDisplayState(value: string): value is GoalDisplayState {
  return Object.hasOwn(GOAL_LABELS, value);
}

function ActivityToken({ working }: { working: boolean }) {
  const label = working ? "Working" : "Ready";
  return (
    <span
      className="inline-flex items-center align-[-0.125em]"
      aria-label={label}
      title={label}
      data-status-icon="activity"
      data-state={working ? "working" : "ready"}
    >
      <span className="sr-only">{label}</span>
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

function GoalToken({ state }: { state: GoalDisplayState }) {
  const label = GOAL_LABELS[state];
  const Icon =
    state === "active"
      ? Target
      : state === "paused"
        ? Pause
        : state === "blocked"
          ? CircleAlert
          : state === "usage"
            ? Gauge
            : state === "budget" || state === "abandoned"
              ? CircleOff
              : CircleCheck;
  return (
    <span
      className="inline-flex items-center align-[-0.125em]"
      aria-label={label}
      title={label}
      data-status-icon="goal"
      data-state={state}
    >
      <span className="sr-only">{`Goal:${state}`}</span>
      <Icon
        aria-hidden="true"
        className={state === "active" ? "size-[1em] motion-safe:animate-pulse" : "size-[1em]"}
        strokeWidth={state === "paused" ? 2.5 : 2.25}
      />
    </span>
  );
}

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
        <span className="sr-only">Ctx </span>
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
    return <ActivityToken working={token === "Working"} />;
  }

  const goal = GOAL_TOKEN.exec(token);
  const goalState = goal?.[1];
  if (goalState && isGoalDisplayState(goalState)) return <GoalToken state={goalState} />;

  if (token === "Approve") {
    return (
      <span
        className="inline-flex items-center align-[-0.125em]"
        aria-label="Approve for me"
        title="Approve for me"
        data-status-icon="approval"
      >
        <span className="sr-only">Approve</span>
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
        <span className="sr-only">{token}</span>
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
        title={`Tasks ${value}`}
        data-status-icon="tasks"
      >
        <span className="sr-only">Tasks </span>
        <ListChecks aria-hidden="true" className="size-[1em]" strokeWidth={2.25} />
        <span aria-hidden="true">{value}</span>
      </span>
    );
  }

  return token;
}

export function StatuslineSegment({ agent, segment }: StatuslineSegmentProps) {
  if (agent !== "codex") {
    return <span style={styleFor(segment)}>{segment.text}</span>;
  }

  return (
    <span style={styleFor(segment)}>
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
