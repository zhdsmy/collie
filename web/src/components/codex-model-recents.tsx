import { useEffect, useState } from "react";
import { Check, Trash2, X } from "lucide-react";

import { DestructiveActionRow } from "@/components/action-sheet-rows";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { ComposerDock } from "@/components/ui/composer-dock";
import { OneOf } from "@/components/ui/one-of";
import { useLocale } from "@/hooks/use-locale";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import type { CodexModelTarget } from "@/lib/harness/codex/model-field";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CodexModelRecentsPanelProps {
  onClose: () => void;
  current?: { model: string; effort: string | null };
  recents: readonly CodexModelTarget[];
  onSelect: (target: CodexModelTarget) => void;
  onNative: () => void;
  onRemove: (target: CodexModelTarget) => void;
  onClear: () => void;
  disabledReason?: string;
  busy?: boolean;
  sessionAvailable?: boolean;
}

/** An in-flow Composer dock above the statusline; opening it never focuses the reply input. */
export function CodexModelRecentsPanel({
  onClose,
  current,
  recents,
  onSelect,
  onNative,
  onRemove,
  onClear,
  disabledReason,
  busy = false,
  sessionAvailable = true,
}: CodexModelRecentsPanelProps) {
  useLocale();
  const [managing, setManaging] = useState(false);
  const armed = usePendingConfirm();
  const disabled = busy || disabledReason !== undefined;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <section id="codex-model-recents" aria-label={t("codexModel.recentsAria")}>
      <ComposerDock
        title={t("codexModel.recentsTitle")}
        onClose={onClose}
        className="mx-0 mb-0"
        actions={
          <>
            <Button variant="ghost" disabled={disabled} onClick={onNative}
              className="h-11 px-2 text-xs font-normal text-muted-foreground">
              {t("codexModel.native")}
            </Button>
            <Button variant="ghost" disabled={disabled || recents.length === 0}
              aria-pressed={managing} onClick={() => setManaging(!managing)}
              className="h-11 px-2 text-xs font-normal text-muted-foreground">
              <OneOf active={managing ? "done" : "manage"} options={[
                { key: "manage", node: t("codexModel.manage") },
                { key: "done", node: t("codexModel.done") },
              ]} />
            </Button>
          </>
        }
      >
        {recents.length > 0 ? (
          <div className="max-h-33 overflow-y-auto overscroll-contain px-3">
            {recents.map((entry) => {
              const selected = current?.model === entry.model && current.effort === entry.effort;
              return (
                <div key={`${entry.model} ${entry.effort}`}
                  className={cn("flex min-h-11 items-center rounded-md", selected ? "bg-muted/60" : "hover:bg-accent")}>
                  <button type="button" onClick={() => onSelect(entry)} disabled={disabled}
                    aria-current={selected ? "true" : undefined}
                    aria-label={`${entry.model} ${entry.effort}`}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60">
                    <Check aria-hidden="true" className={cn("size-3.5 shrink-0 text-primary", !selected && "invisible")} />
                    <span className="min-w-0 flex-1 font-mono text-xs leading-4 [overflow-wrap:anywhere]">{entry.model}</span>
                    <span className="shrink-0 font-mono text-xs leading-4 text-muted-foreground">{entry.effort}</span>
                  </button>
                  {/* Animate the management column without leaving an empty slot in the normal list. */}
                  <div inert={!managing} aria-hidden={!managing}
                    className={cn("shrink-0 overflow-hidden transition-[width] duration-[240ms] motion-reduce:transition-none", managing ? "w-11" : "w-0")}>
                    <Button variant="ghost" size="icon" disabled={disabled}
                      onClick={() => onRemove(entry)}
                      aria-label={t("codexModel.removeAria", { model: entry.model, effort: entry.effort })}
                      className="size-11 text-muted-foreground hover:text-destructive">
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-3 py-3 text-xs text-muted-foreground">{t(sessionAvailable ? "codexModel.emptyRecents" : "codexModel.sessionPending")}</p>
        )}
        <Collapse open={managing && recents.length > 0}>
          <div className="border-t border-border px-3 py-1">
            <DestructiveActionRow
              icon={<Trash2 className="size-4 shrink-0" aria-hidden="true" />}
              label={t("codexModel.clearHistory")}
              confirmLabel={t("codexModel.clearHistoryConfirm")}
              closingLabel={t("codexModel.clearHistory")}
              armed={armed.pending === "clear"}
              closing={false}
              disabled={disabled}
              className="text-xs"
              onClick={() => { if (armed.confirm("clear")) onClear(); }}
            />
          </div>
        </Collapse>
      </ComposerDock>
    </section>
  );
}
