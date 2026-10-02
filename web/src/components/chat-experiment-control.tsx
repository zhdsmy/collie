import { MessagesSquare } from "lucide-react";

import { ExperimentCard } from "@/components/experiment-card";
import { useDashPrefs } from "@/hooks/use-dash-prefs";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";

/**
 * Whether this device offers Chat at all — the opt-in, and the first thing filed under Experiments.
 *
 * OFF by default. 1.15.0 ships Chat's reader for six harnesses and its screen on the first pass, and
 * two things are known to be incomplete on the day it ships: codex tool calls are invisible until
 * spec 12 lands, and hermes can lose a turn with no reducer able to tell (ADR 0073's Consequences).
 * Default-on would make those the first impression of the release. Default-off with a named switch
 * makes them the cost of opting in, and the caveat under the description names both rather than
 * leaving them to be discovered.
 *
 * It is the AVAILABILITY, not the mode. Turning it on hands the operator Chat at once — an opted-in
 * device reads `DashPrefs.paneView`, whose stored default is `chat` for exactly that reason — and
 * the pane's ⋮ menu is where the mode itself is then chosen, once, for the whole device (ADR 0071's
 * shape). lib/pane-view.ts holds the argument for why those are two values and not one.
 *
 * "Terminal stays the default, and the default flips in 2.0" is still true, and this switch is what
 * makes it true: a device that never opens this row draws terminals. When the gate goes in 2.0, the
 * stored default underneath IS the flip.
 */
export function ChatExperimentControl() {
  useLocale();
  const { prefs, setChatExperiment } = useDashPrefs();
  return (
    <ExperimentCard
      icon={MessagesSquare}
      title={t("settings.experiments.chat.title")}
      description={t("settings.experiments.chat.description")}
      caveat={t("settings.experiments.chat.caveat")}
      checked={prefs.chatExperiment}
      onCheckedChange={setChatExperiment}
    />
  );
}
