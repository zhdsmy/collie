import { Palette, Sparkles } from "lucide-react";
import { Card as IslandCard, Button as IslandButton, Icon as IslandIcon } from "animal-island-ui";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDesignPrefs, setDesignTheme } from "@/lib/design";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/** The visual skin is independent from the light/dark color-scheme preference. */
export function VisualThemeControl() {
  useLocale();
  const prefs = useDesignPrefs();
  const active = prefs.theme === "animal-island";

  const content = (
    <>
      <div className="visual-theme-control__header">
        <Palette className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
        <div>
          <div id="visual-theme-title" className="visual-theme-control__title">
            {t("settings.visualTheme.title")}
          </div>
          <p className="visual-theme-control__description">{t("settings.visualTheme.description")}</p>
        </div>
      </div>
      <div className="visual-theme-control__actions" role="group" aria-label={t("settings.visualTheme.title")}>
        <Button
          variant={active ? "default" : "outline"}
          aria-pressed={active}
          onClick={() => setDesignTheme(active ? "classic" : "animal-island")}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span className="visual-theme-control__action-label">
            {active ? t("settings.visualTheme.action.classic") : t("settings.visualTheme.action.island")}
          </span>
        </Button>
      </div>
    </>
  );

  if (!active) {
    return <Card className="visual-theme-control" aria-labelledby="visual-theme-title">{content}</Card>;
  }

  return (
    <IslandCard className="visual-theme-control" aria-labelledby="visual-theme-title">
      <div className="visual-theme-control__header">
        <IslandIcon className="mt-0.5 shrink-0" icon={Palette} size={20} aria-hidden="true" />
        <div>
          <div id="visual-theme-title" className="visual-theme-control__title">
            {t("settings.visualTheme.title")}
          </div>
          <p className="visual-theme-control__description">{t("settings.visualTheme.description")}</p>
        </div>
      </div>
      <div className="visual-theme-control__actions" role="group" aria-label={t("settings.visualTheme.title")}>
        <IslandButton
          type={active ? "primary" : "default"}
          icon={<Sparkles size={16} aria-hidden="true" />}
          aria-pressed={active}
          onClick={() => setDesignTheme(active ? "classic" : "animal-island")}
        >
          <span className="visual-theme-control__action-label">
            {active ? t("settings.visualTheme.action.classic") : t("settings.visualTheme.action.island")}
          </span>
        </IslandButton>
      </div>
    </IslandCard>
  );
}
