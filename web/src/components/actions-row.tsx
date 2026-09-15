import { Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HarnessBar, useHarnessBarItems } from "@/components/harness-bar";
import { OverflowEdges } from "@/components/ui/overflow-edges";
import { SectionLabel } from "@/components/ui/section-label";
import { STRIP_ROW_PILL, STRIP_SCROLLER } from "@/components/ui/labelled-strip";
import { useLocale } from "@/hooks/use-locale";
import { t as translate } from "@/lib/i18n";
import type { OperatorCommand } from "@/lib/types";
import { cn } from "@/lib/utils";

// One scrolling action row on the composer's chrome, with the pane switcher in its own flex cell.
// Keeping Switch outside the scroller reserves its real width without an overlay or measurements.
const ON = "bg-control-on text-control-on-foreground hover:bg-control-on";
const OFF = "text-muted-foreground";

/**
 * One of Collie's own actions. The composer owns every one of these — what it does, whether it is
 * on, whether it is refused — and this file owns only how it is drawn.
 */
export interface GeneralAction {
  /** Stable, for React's key. Never shown. */
  id: string;
  icon: LucideIcon;
  /** ALREADY TRANSLATED. The button's accessible name — what a reader announces and what a test
   *  addresses. It is never shortened for the paint. */
  label: string;
  /** ALREADY TRANSLATED. The word the pill DRAWS, when the accessible name is too long to wear: the
   *  row shows "Type" and announces "Type into terminal". Defaults to {@link label}.
   *
   *  It must be a prefix-or-part of `label` and never a different word — a visible word the
   *  accessible name does not contain is the WCAG 2.5.3 failure, and it also means a person saying
   *  "tap Display" and a reader hearing "Display settings" are no longer talking about one button. */
  word?: string;
  /** Draws the "on" tint: the dock this opens is open, or the mode it arms is armed. */
  on?: boolean;
  /** Set for a control that opens a dock — it becomes `aria-expanded`. */
  expanded?: boolean;
  /** Set for a control that toggles a mode — it becomes `aria-pressed`. */
  pressed?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionsRowProps {
  /** Collie's own actions, in the order the thumb should meet them. */
  general: readonly GeneralAction[];
  /** The focused pane's agent — picks the harness section and its brand colour. */
  agent: string | undefined | null;
  /** The snapshot's `operatorCommands`; the `bar = true` ones replace the shipped bar (ADR 0043). */
  mine?: readonly OperatorCommand[];
  /** Bound to `(t) => send(t, false)`. Resolving true drives the harness checkmark. */
  onRun: (text: string) => Promise<boolean>;
  /** Bound to the composer's `locked`. Greys the harness buttons in place. */
  disabled?: boolean;
  /** The whole belt handles an upward drag; the pinned button alone handles a tap. */
  handle?: {
    /** {@link import("@/hooks/use-sheet-pull").useSheetPull}'s ref — the finger-tracked drag. It
     *  lands on the BELT, not on the pill: the whole band is the drag surface. */
    ref: (node: HTMLElement | null) => void;
    /** The tap, on the SWITCH PILL. Opens the same switcher sheet the drag opens. */
    onClick: () => void;
    /** ALREADY TRANSLATED. The button's accessible name — "Switch pane". */
    label: string;
  };
}

export function ActionsRow({ general, agent, mine, onRun, disabled, handle }: ActionsRowProps) {
  useLocale();
  const harnessItems = useHarnessBarItems(agent, mine);
  if (general.length === 0 && harnessItems.length === 0) return null;

  return (
    <div
      data-slot="composer-actions"
      ref={handle?.ref}
      className={cn(
        "-mx-3 mb-1 flex items-center border-b border-border bg-chrome",
        handle && "touch-pan-x",
      )}
    >
      {/* Only the left edge fades after scrolling. Switch owns a separate cell, so the
          last action can always scroll fully into view without sliding under it. */}
      <OverflowEdges edges="left" cue="none">
        {(scrollerRef) => (
          <div
            ref={scrollerRef}
            className={cn(STRIP_SCROLLER, "pl-3 py-0 overflow-y-hidden", handle ? "pr-1" : "pr-3")}
          >
            {general.length > 0 && (
              <div
                data-slot="composer-controls"
                role="group"
                aria-labelledby="composer-controls-label"
                className="flex shrink-0 items-center gap-1.5"
              >
                <SectionLabel id="composer-controls-label" className="sr-only">
                  {translate("composer.controls.label")}
                </SectionLabel>
                {general.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={action.disabled}
                    aria-label={action.label}
                    aria-expanded={action.expanded}
                    aria-pressed={action.pressed}
                    onClick={action.onSelect}
                    className={cn(`${STRIP_ROW_PILL} gap-1.5 text-xs`, action.on === true ? ON : OFF)}
                  >
                    <action.icon className="size-4 shrink-0" />
                    {action.word ?? action.label}
                  </Button>
                ))}
              </div>
            )}
            <HarnessBar agent={agent} mine={mine} onRun={onRun} disabled={disabled} />
          </div>
        )}
      </OverflowEdges>
      {handle && (
        <span className="flex shrink-0 items-center self-stretch pr-3 pl-1">
          <span aria-hidden className="mr-2 h-5 w-px bg-border" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={handle.label}
            aria-haspopup="dialog"
            onClick={handle.onClick}
            className={cn(`${STRIP_ROW_PILL} relative w-8 min-w-8 border-0 px-0 has-[>svg]:px-0`)}
          >
            <Layers className="size-4 shrink-0 text-primary" />
          </Button>
        </span>
      )}
    </div>
  );
}
