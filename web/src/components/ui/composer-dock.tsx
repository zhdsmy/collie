import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/** Shared in-flow Composer panel with a fixed header and scrollable body. */
export function ComposerDock({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useLocale();
  return (
    <div className="-mx-3 mb-2 flex flex-col border-t border-border bg-background">
      <div className="flex items-center justify-between gap-2 px-3 py-1">
        <h2 className="min-w-0">
          <SectionLabel className="min-w-0 shrink text-base font-bold normal-case tracking-normal">{title}</SectionLabel>
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          onClick={onClose}
          aria-label={t("composer.dock.closeAria", { title })}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="max-h-[45dvh] min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

