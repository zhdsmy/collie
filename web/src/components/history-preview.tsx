import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapse, COLLAPSE_MS } from "@/components/ui/collapse";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Presentation only: expanding history never sends keys or focuses the agent's input. */
export function HistoryPreview({ children, query, currentMatch }: {
  children: ReactNode;
  query: string;
  currentMatch: number;
}) {
  useLocale();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  // Find must never report a match that the folded history hides.
  useEffect(() => { if (query.trim()) setOpen(true); }, [query, currentMatch]);
  useEffect(() => {
    if (!open || !query.trim()) return;
    // Collapse mounts after this render, then expands over two frames and its shared duration.
    const timer = window.setTimeout(() => {
      bodyRef.current?.querySelector('[data-find-match="current"]')?.scrollIntoView({ block: "center", behavior: "auto" });
    }, COLLAPSE_MS + 32);
    return () => window.clearTimeout(timer);
  }, [open, query, currentMatch]);
  return (
    <Card className="my-1.5 min-w-0 gap-0 overflow-hidden p-0 shadow-none">
      <Button type="button" variant="ghost" aria-expanded={open} aria-controls={bodyId}
        onClick={() => setOpen(!open)} className="min-h-11 w-full justify-start gap-2 px-3 text-sm">
        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {t("chat.historyPreview.title")}
        <ChevronRight className={cn("ml-auto size-4 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
      </Button>
      <Collapse open={open}>
        <div ref={bodyRef} id={bodyId} role="region" aria-label={t("chat.historyPreview.title")}
          className="max-h-[min(45dvh,28rem)] min-w-0 overflow-auto overscroll-contain border-t border-border px-2">
          {children}
        </div>
      </Collapse>
    </Card>
  );
}
