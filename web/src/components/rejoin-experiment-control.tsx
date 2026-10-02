import { WrapText } from "lucide-react";

import { ExperimentCard } from "@/components/experiment-card";
import { useDashPrefs } from "@/hooks/use-dash-prefs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/**
 * Whether this device offers rejoining wrapped rows at all (lib/wrap-join.ts).
 *
 * The AVAILABILITY, like Chat's card: on, the pane's Display sheet grows the row that turns it on
 * and off, and that row starts on, so opting in shows the result at once. Off, the Display sheet is
 * exactly what it was.
 */
export function RejoinExperimentControl() {
  useLocale();
  const { prefs, setRejoinExperiment } = useDashPrefs();
  return (
    <ExperimentCard
      icon={WrapText}
      title={t("settings.experiments.rejoin.title")}
      description={t("settings.experiments.rejoin.description")}
      caveat={t("settings.experiments.rejoin.caveat")}
      checked={prefs.rejoinExperiment}
      onCheckedChange={setRejoinExperiment}
    />
  );
}
