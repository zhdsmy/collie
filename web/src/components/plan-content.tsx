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

/** The plan body and its recap. The card scrolls them as one region; the decisions stay outside. */
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
        <div
          id={bodyId}
          role="region"
          aria-label={t("dialog.plan.body")}
          className="min-w-0 border-t border-border px-2 py-2"
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
          <div role="region" aria-label={t("dialog.plan.recap")} className="min-w-0 border-t border-border px-2 py-2">
            <MarkdownText text={recap} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
