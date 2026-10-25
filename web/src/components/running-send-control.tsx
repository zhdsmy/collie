import { Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

export function RunningSendControl() {
  useLocale();
  const { prefs, setCodexSendMode, setClaudeSendMode } = useDisplayPrefs();
  return (
    <>
      {(["codex", "claude"] as const).map((agent) => {
        const title = t(agent === "codex" ? "settings.codexSend.title" : "settings.claudeSend.title");
        return (
          <Card key={agent} className="gap-0 py-0">
            <div className="flex items-start gap-3 p-4">
              <Send className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-medium">{title}</div>
                <p className="text-sm text-muted-foreground">{t(agent === "codex" ? "settings.codexSend.description" : "settings.claudeSend.description")}</p>
              </div>
            </div>
            <div className="border-t border-border p-2">
              <Segmented
                options={[{ value: "queue", label: t("settings.codexSend.queue") }, { value: "steer", label: t("settings.codexSend.steer") }]}
                value={(agent === "codex" ? prefs.codexSendMode : prefs.claudeSendMode) ?? "queue"}
                onChange={agent === "codex" ? setCodexSendMode : setClaudeSendMode}
                label={title}
                semantics="choice"
              />
            </div>
          </Card>
        );
      })}
    </>
  );
}
