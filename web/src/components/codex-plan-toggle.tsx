import { useId } from "react";
import { ClipboardCheck, ClipboardList, CircleHelp, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OneOf } from "@/components/ui/one-of";
import { useLocale } from "@/hooks/use-locale";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CodexPlanToggleProps {
  enabled: boolean | null;
  busy: boolean;
  disabledReason?: string;
  onClick: () => void;
}

type PlanVisualState = "on" | "off" | "unknown" | "switching";

const STATE_LABELS = {
  on: "codexPlan.on",
  off: "codexPlan.off",
  unknown: "codexPlan.unknown",
  switching: "codexPlan.switching",
} as const satisfies Record<PlanVisualState, MessageKey>;

const STATE_ICONS = {
  on: ClipboardCheck,
  off: ClipboardList,
  unknown: CircleHelp,
  switching: Loader2,
} satisfies Record<PlanVisualState, LucideIcon>;

const STATE_TONES = {
  on: "text-violet-600 dark:text-violet-400",
  off: "text-muted-foreground",
  unknown: "text-muted-foreground",
  switching: "text-muted-foreground",
} satisfies Record<PlanVisualState, string>;

const STATE_ORDER: ReadonlyArray<PlanVisualState> = ["on", "off", "unknown", "switching"];

function visualState(enabled: boolean | null, busy: boolean): PlanVisualState {
  if (busy) return "switching";
  if (enabled === null) return "unknown";
  return enabled ? "on" : "off";
}

/** Compact app-owned Plan mode status and toggle, kept outside the inverted terminal surface. */
export function CodexPlanToggle({ enabled, busy, disabledReason, onClick }: CodexPlanToggleProps) {
  useLocale();
  const state = visualState(enabled, busy);
  const Icon = STATE_ICONS[state];
  const stateLabel = t(STATE_LABELS[state]);
  const description = disabledReason ?? (state === "unknown" ? t("codexPlan.unknown") : state === "switching" ? t("codexPlan.busy") : undefined);
  const descriptionId = useId();
  const disabled = enabled === null || busy || disabledReason !== undefined;

  return (
    <div
      data-slot="codex-plan-toggle"
      title={disabledReason}
      className="flex min-h-10 shrink-0 items-center bg-background px-3"
    >
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        aria-label={`${t("codexPlan.title")}: ${stateLabel}`}
        aria-pressed={enabled === null ? undefined : enabled}
        aria-describedby={description ? descriptionId : undefined}
        onClick={onClick}
        className="min-h-9 min-w-0 flex-1 justify-between rounded-md px-2 py-1 text-xs font-medium"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon
            aria-hidden="true"
            className={cn("size-3.5 shrink-0", STATE_TONES[state], state === "switching" && "animate-spin motion-reduce:animate-none")}
          />
          <span className="shrink-0">{t("codexPlan.title")}</span>
        </span>
        <OneOf
          active={state}
          className="min-w-0 shrink-0 justify-items-end"
          layerClassName="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide"
          options={STATE_ORDER.map((key) => ({
            key,
            node: t(STATE_LABELS[key]),
          }))}
        />
      </Button>
      {description ? <span id={descriptionId} className="sr-only">{description}</span> : null}
    </div>
  );
}
