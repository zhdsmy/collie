import { useId, useState } from "react";
import { ChevronRight, FileText, History } from "lucide-react";

import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface PlanContentSource {
  text: string;
  complete: boolean;
  recap?: string;
}

/** Long plans scroll inside the reading area; decision buttons belong outside this component. */
export function PlanContent({ text, complete, recap }: PlanContentSource) {
  useLocale();
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <div className="min-w-0 rounded-lg border border-border">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="h-auto min-h-9 w-full justify-start gap-1.5 px-2 py-1.5 text-xs"
      >
        <FileText className="size-3.5 shrink-0" aria-hidden />
        {t("dialog.plan.title")}
        <ChevronRight className={cn("ml-auto size-3.5 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
      </Button>
      {!complete ? (
        <p className="px-2 pb-1.5 text-xs leading-snug text-muted-foreground">{t("dialog.plan.partial")}</p>
      ) : null}
      <Collapse open={open}>
        {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll region must support keyboard scrolling in Safari. */}
        <div tabIndex={0}
          id={bodyId}
          role="region"
          aria-label={t("dialog.plan.body")}
          className="max-h-[min(40dvh,24rem)] min-w-0 overflow-auto overscroll-contain border-t border-border px-2 py-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
        >
          <MarkdownText text={text} />
        </div>
      </Collapse>
      {recap ? (
        <details className="group min-w-0 border-t border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-2 text-xs text-muted-foreground marker:hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <History className="size-3.5 shrink-0" aria-hidden />
            {t("dialog.plan.recap")}
            <ChevronRight className="ml-auto size-3.5 group-open:rotate-90" aria-hidden />
          </summary>
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll region must support keyboard scrolling in Safari. */}
          <div tabIndex={0} role="region" aria-label={t("dialog.plan.recap")}
            className="max-h-[min(24dvh,16rem)] min-w-0 overflow-auto overscroll-contain border-t border-border px-2 py-2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2">
            <MarkdownText text={recap} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
