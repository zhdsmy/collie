import { Rows3 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useDashPrefs, type NavGlass } from "@/hooks/use-dash-prefs";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: readonly NavGlass[] = ["react", "dom"];

export function NavGlassControl() {
  const { prefs, setNavGlass } = useDashPrefs();

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 p-4">
        <Rows3 className="size-5 shrink-0 text-muted-foreground" />
        <div className="font-medium">{t("settings.navGlass.title")}</div>
      </div>
      <div role="radiogroup" aria-label={t("settings.navGlass.title")} className="flex gap-1 border-t border-border p-2">
        {OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={prefs.navGlass === option}
            onClick={() => setNavGlass(option)}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2 text-center text-xs font-medium transition-colors",
              prefs.navGlass === option ? "bg-primary text-primary-foreground" : "text-muted-foreground active:bg-muted",
            )}
          >
            {t(option === "react" ? "settings.navGlass.react" : "settings.navGlass.dom")}
          </button>
        ))}
      </div>
    </Card>
  );
}
