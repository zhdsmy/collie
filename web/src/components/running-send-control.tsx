import { Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export function RunningSendControl() {
  useLocale();
  const { prefs, setRunningSendMode } = useDisplayPrefs();
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-start gap-3 p-4">
        <Send className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <div className="font-medium">{t("settings.runningSend.title")}</div>
          <p className="text-sm text-muted-foreground">{t("settings.runningSend.description")}</p>
          <p className="text-sm text-muted-foreground">{t("settings.runningSend.scope")}</p>
          <p className="text-sm text-muted-foreground">{t("settings.runningSend.claudeNote")}</p>
        </div>
      </div>
      <div className="border-t border-border p-2">
        <Segmented
          options={[{ value: "queue", label: t("settings.runningSend.queue") }, { value: "steer", label: t("settings.runningSend.steer") }]}
          value={prefs.runningSendMode ?? "queue"}
          onChange={setRunningSendMode}
          label={t("settings.runningSend.title")}
          semantics="choice"
        />
      </div>
    </Card>
  );
}
