import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Shared in-flow Composer panel with a fixed header and scrollable body. */
export function ComposerDock({
  title,
  onClose,
  children,
  actions,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  useLocale();
  return (
    <div className={cn("-mx-3 mb-2 flex flex-col border-t border-border bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 px-3 py-1">
        <h2 className="min-w-0">
          <SectionLabel className="min-w-0 shrink text-base font-bold normal-case tracking-normal">{title}</SectionLabel>
        </h2>
        <div className="ml-auto flex min-w-0 items-center gap-1">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground"
            onClick={onClose}
            aria-label={t("composer.dock.closeAria", { title })}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="max-h-[45dvh] min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
