import { useId, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";

import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface PlanContentSource {
  text: string;
  format: "markdown" | "terminal";
  complete: boolean;
}

/** Long plans scroll inside the reading area; decision buttons belong outside this component. */
export function PlanContent({ text, format, complete }: PlanContentSource) {
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
          {format === "markdown" ? <MarkdownText text={text} /> : (
            <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{text}</pre>
          )}
        </div>
      </Collapse>
    </div>
  );
}
