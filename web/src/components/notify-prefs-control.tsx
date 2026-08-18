import { BellRing, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useNotifyPrefs } from "@/hooks/use-notify-prefs";
import type { NotifyPrefs } from "@/lib/api";

// Which lifecycle events are worth a push. Bridge-wide (fans out to every device, like the snooze),
// so the copy says so. Three switches: "Needs input" (blocked, default on), "Finished" (done,
// default off), and "App updates" (updates, default on). Optimistic toggle with revert on failure —
// see useNotifyPrefs.

const ROWS = [
  { key: "blocked", labelKey: "settings.notifyNeedsInput", hintKey: "settings.notifyNeedsInputHint" },
  { key: "done", labelKey: "settings.notifyFinished", hintKey: "settings.notifyFinishedHint" },
  { key: "updates", labelKey: "settings.notifyAppUpdates", hintKey: "settings.notifyAppUpdatesHint" },
] as const satisfies ReadonlyArray<{
  key: keyof NotifyPrefs;
  labelKey: "settings.notifyNeedsInput" | "settings.notifyFinished" | "settings.notifyAppUpdates";
  hintKey:
    | "settings.notifyNeedsInputHint"
    | "settings.notifyFinishedHint"
    | "settings.notifyAppUpdatesHint";
}>;

export function NotifyPrefsControl() {
  const { t } = useTranslation();
  const { prefs, busy, toggle } = useNotifyPrefs();

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <BellRing className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium">{t("settings.notifyWhen")}</div>
            <p className="text-sm text-muted-foreground">{t("settings.notifyAllDevices")}</p>
          </div>
        </div>
        {!prefs && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* Rendered before `prefs` lands, not after. ROWS is static, so the card's SHAPE is known from
          the first frame — only the switch values are pending. Gating the whole list on `prefs` grew
          this card by ~180px a moment after paint and pushed the rest of the page down with it. The
          switches stay disabled until the real values arrive, so nothing can be toggled from a
          placeholder state. */}
      {ROWS.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{t(row.labelKey)}</div>
              <p className="text-xs text-muted-foreground">{t(row.hintKey)}</p>
            </div>
            <Switch
              checked={prefs?.[row.key] ?? false}
              disabled={busy || !prefs}
              onCheckedChange={(next) => void toggle(row.key, next)}
              aria-label={t(row.labelKey)}
            />
          </div>
      ))}
    </Card>
  );
}
