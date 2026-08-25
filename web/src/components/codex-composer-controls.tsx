import { Cpu, Loader2, Map, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { CodexSessionState } from "@/lib/harness/codex/session-state";
import { cn } from "@/lib/utils";

export type CodexComposerCommand = "/permissions" | "/model" | "/fast" | "/plan";

interface CodexComposerControlsProps {
  state: CodexSessionState | undefined;
  busy: CodexComposerCommand | null;
  disabled: boolean;
  onCommand: (command: CodexComposerCommand) => void;
}

const CONTROL =
  "size-9 shrink-0 rounded-full text-muted-foreground has-[>svg]:px-0 disabled:opacity-35";
const CONTROL_ON = "bg-control-on text-control-on-foreground hover:bg-control-on";

export function CodexComposerControls({
  state,
  busy,
  disabled,
  onCommand,
}: CodexComposerControlsProps) {
  const { t } = useTranslation();
  const waiting = busy !== null;
  const permissionKnown = state?.approval !== undefined;
  const fastKnown = state?.fast !== undefined;
  const working = state?.activity === "working";
  const permissionLabel = permissionKnown
    ? t("composer.codexPermissionsState", { mode: state.approval })
    : t("composer.codexPermissionsUnavailable");
  const modelLabel = state?.model
    ? t("composer.codexModelState", { model: state.model })
    : t("composer.codexModel");
  const fastLabel = fastKnown
    ? t(state.fast ? "composer.codexFastOn" : "composer.codexFastOff")
    : t("composer.codexFastUnavailable");
  const planLabel = working ? t("composer.codexPlanWorking") : t("composer.codexPlan");

  const icon = (command: CodexComposerCommand, fallback: ReactNode) =>
    busy === command ? <Loader2 className="size-4 animate-spin" /> : fallback;

  return (
    <div data-slot="codex-composer-controls" className="flex min-w-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={CONTROL}
        disabled={disabled || waiting || !permissionKnown}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => onCommand("/permissions")}
        aria-label={permissionLabel}
        title={permissionLabel}
      >
        {icon("/permissions", <ShieldCheck className="size-4" />)}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          CONTROL,
          "min-[390px]:w-[5.25rem] min-[390px]:justify-start min-[390px]:gap-1 min-[390px]:px-2 min-[390px]:has-[>svg]:px-2",
        )}
        disabled={disabled || waiting}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => onCommand("/model")}
        aria-label={modelLabel}
        title={modelLabel}
      >
        {icon("/model", <Cpu className="size-4 shrink-0" />)}
        {busy !== "/model" && (
          <span className="hidden min-w-0 truncate text-[11px] min-[390px]:inline">
            {state?.model ?? t("composer.codexModel")}
          </span>
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(CONTROL, state?.fast === true && CONTROL_ON)}
        disabled={disabled || waiting || !fastKnown}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => onCommand("/fast")}
        aria-label={fastLabel}
        aria-pressed={fastKnown ? state.fast : undefined}
        title={fastLabel}
      >
        {icon(
          "/fast",
          <Zap
            className="size-4"
            fill={state?.fast === true ? "currentColor" : "none"}
            strokeWidth={2.25}
          />,
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={CONTROL}
        disabled={disabled || waiting || working}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => onCommand("/plan")}
        aria-label={planLabel}
        title={planLabel}
      >
        {icon("/plan", <Map className="size-4" />)}
      </Button>
    </div>
  );
}
