import type { ChangeEvent } from "react";
import { ChevronDown, TerminalSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/ui/card";
import { useTerminalFont, type TerminalFont } from "@/hooks/use-terminal-font";

const OPTIONS: ReadonlyArray<{ value: TerminalFont; label: string }> = [
  { value: "system-mono", label: "System Mono" },
  { value: "geist-mono", label: "Geist Mono" },
  { value: "jetbrains-mono", label: "JetBrains Mono" },
];

export function TerminalFontControl() {
  const { t } = useTranslation();
  const { font, setFont } = useTerminalFont();

  function select(event: ChangeEvent<HTMLSelectElement>) {
    setFont(event.currentTarget.value as TerminalFont);
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 p-4">
        <TerminalSquare className="size-5 shrink-0 text-muted-foreground" />
        <div className="font-medium">{t("settings.terminalTitle")}</div>
      </div>

      <div className="flex min-h-14 items-center justify-between gap-4 border-t border-border/60 px-4 py-2">
        <label htmlFor="terminal-font" className="min-w-0 text-sm font-medium">
          {t("settings.monospaceFont")}
        </label>
        <div className="relative shrink-0">
          <select
            id="terminal-font"
            value={font}
            onChange={select}
            className="h-10 w-[10.5rem] max-w-[56vw] appearance-none truncate rounded-md border border-input bg-background py-2 pr-8 pl-3 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>
    </Card>
  );
}
