import { ClipboardCheck, ClipboardList, CircleHelp, Loader2, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CodexMode } from "@/lib/codex-mode-switch";

export interface CodexModeToggleProps {
  mode: CodexMode;
  enabled: boolean | null;
  busy: boolean;
  disabledReason?: string;
  onClick: () => void;
}

type VisualState = "on" | "off" | "unknown" | "switching";

const MODE_LABELS = {
  plan: "codexMode.planLabel",
  fast: "codexMode.fastLabel",
} as const satisfies Record<CodexMode, MessageKey>;

const STATE_LABELS = {
  plan: {
    on: "codexPlan.on",
    off: "codexPlan.off",
    unknown: "codexPlan.unknown",
    switching: "codexPlan.switching",
  },
  fast: {
    on: "codexFast.on",
    off: "codexFast.off",
    unknown: "codexFast.unknown",
    switching: "codexFast.switching",
  },
} as const satisfies Record<CodexMode, Record<VisualState, MessageKey>>;

const ICONS = {
  plan: {
    on: ClipboardCheck,
    off: ClipboardList,
    unknown: CircleHelp,
    switching: Loader2,
  },
  fast: {
    on: Zap,
    off: Zap,
    unknown: CircleHelp,
    switching: Loader2,
  },
} satisfies Record<CodexMode, Record<VisualState, LucideIcon>>;

// Statusline controls live in the terminal's dark colour space and are inverted with the rest of it.
const TONES = {
  planOn: "#d670d6",
  fastOn: "#3b8eea",
  neutral: "#a1a1a1",
  foreground: "#fafafa",
} as const;

function visualState(enabled: boolean | null, busy: boolean): VisualState {
  if (busy) return "switching";
  if (enabled === null) return "unknown";
  return enabled ? "on" : "off";
}

function iconTone(mode: CodexMode, state: VisualState): string {
  if (state === "on") return mode === "plan" ? TONES.planOn : TONES.fastOn;
  return TONES.neutral;
}

/** A compact Plan/Fast toggle that can sit inside the one-line statusline. */
export function CodexModeToggle({ mode, enabled, busy, disabledReason, onClick }: CodexModeToggleProps) {
  useLocale();
  const state = visualState(enabled, busy);
  const Icon = ICONS[mode][state];
  const stateLabel = t(STATE_LABELS[mode][state]);
  const label = t(MODE_LABELS[mode]);
  const disabled = busy || enabled === null || disabledReason !== undefined;
  const namespace = mode === "plan" ? "codexPlan" : "codexFast";
  const description = disabledReason ?? (busy ? t(`${namespace}.busy`) : state === "unknown" ? stateLabel : undefined);
  const descriptionId = useId();

  return (
    <span data-slot="codex-mode-toggle" data-mode={mode} title={disabledReason} className="inline-flex h-3.5 shrink-0 items-center">
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        aria-label={`${t(`${namespace}.title`)}: ${stateLabel}`}
        aria-pressed={enabled === null ? undefined : enabled}
        aria-describedby={description ? descriptionId : undefined}
        onClick={onClick}
        style={{ color: TONES.foreground }}
        className="h-3.5 min-h-3.5 gap-1 rounded-sm border-0 bg-transparent px-0 py-0 text-[11px] font-normal leading-none hover:bg-white/10 hover:text-[#fafafa] has-[>svg]:px-0"
      >
        <Icon
          aria-hidden="true"
          className={cn("size-[12px] shrink-0", state === "switching" && "animate-spin motion-reduce:animate-none")}
          strokeWidth={2.25}
          fill={mode === "fast" && state === "on" ? "currentColor" : "none"}
          style={{ color: iconTone(mode, state) }}
        />
        <span className="shrink-0">{label}</span>
      </Button>
      {description ? <span id={descriptionId} className="sr-only">{description}</span> : null}
    </span>
  );
}
