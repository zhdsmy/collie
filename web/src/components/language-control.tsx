import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { useLanguage, type LanguagePreference } from "@/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: ReadonlyArray<{
  value: LanguagePreference;
  labelKey:
    | "common.system"
    | "common.english"
    | "common.simplifiedChinese"
    | "common.traditionalChinese";
}> = [
  { value: "system", labelKey: "common.system" },
  { value: "en", labelKey: "common.english" },
  { value: "zh-CN", labelKey: "common.simplifiedChinese" },
  { value: "zh-TW", labelKey: "common.traditionalChinese" },
];

export function LanguageControl() {
  const { t } = useTranslation();
  const { preference, setLanguage } = useLanguage();

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start gap-3 p-4">
        <Languages className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="font-medium">{t("settings.languageTitle")}</div>
          <p className="text-sm text-muted-foreground">{t("settings.languageDescription")}</p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={t("settings.languageTitle")}
        className="grid grid-cols-2 gap-1 border-t border-border/60 p-2"
      >
        {OPTIONS.map((option) => {
          const selected = option.value === preference;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={option.value === "system" ? undefined : option.value}
              onClick={() => setLanguage(option.value)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm transition-colors",
                selected
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground active:bg-muted",
              )}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
