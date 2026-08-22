import type { ReactNode } from "react";
import { AArrowDown, AArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { DisplayPrefs } from "@/hooks/use-display-prefs";
import { FONT_MAX, FONT_MIN } from "@/hooks/use-display-prefs";

// The mirror's display prefs, as LABELLED rows behind the composer's ⚙ toggle.
//
// These used to be a permanent icon-only "View" row above the Controls row — five 28px glyphs that
// cost a whole row of a phone viewport for settings you touch once and then never again. Worse, the
// raw-terminal toggle was a bare `>_` icon whose only explanation was a `title` attribute no phone
// ever shows; nobody could tell what it did. Behind the ⚙ each pref gets a real name and, where it
// isn't self-evident, a sentence.
//
// It rides the same in-flow ComposerDock as Quick/Agent rather than a covering sheet, deliberately:
// every control here changes how the mirror LOOKS, so you have to be able to see the mirror while
// you flip it.

interface DisplayPrefsContentProps {
  prefs: DisplayPrefs;
  setWrap: (wrap: boolean) => void;
  stepFontSize: (delta: number) => void;
  setRawTerminal: (raw: boolean) => void;
  setTapToFocus: (tapToFocus: boolean) => void;
  setKeepHeaderWhenTyping: (keepHeaderWhenTyping: boolean) => void;
  setHideControlsWhenTyping: (hideControlsWhenTyping: boolean) => void;
}

// One settings row: name (+ optional explanation) on the left, control on the right. Module-level so
// it isn't a fresh component type each render.
function Row({
  label,
  hint,
  htmlFor,
  control,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function DisplayPrefsContent({
  prefs,
  setWrap,
  stepFontSize,
  setRawTerminal,
  setTapToFocus,
  setKeepHeaderWhenTyping,
  setHideControlsWhenTyping,
}: DisplayPrefsContentProps) {
  const { t } = useTranslation();
  return (
    <div className="divide-y divide-border/60 border-t border-border/60 bg-muted/30 px-3 py-1">
      <Row
        label={t("display.wrapLines")}
        hint={t("display.wrapLinesHint")}
        htmlFor="pref-wrap"
        control={
          <Switch
            id="pref-wrap"
            checked={prefs.wrap}
            onCheckedChange={setWrap}
            aria-label={t("display.wrapLines")}
          />
        }
      />
      <Row
        label={t("display.tapToType")}
        hint={t("display.tapToTypeHint")}
        htmlFor="pref-tap-to-focus"
        control={
          <Switch
            id="pref-tap-to-focus"
            checked={prefs.tapToFocus}
            onCheckedChange={setTapToFocus}
            aria-label={t("display.tapToType")}
          />
        }
      />
      <Row
        label={t("display.keepHeaderWhenTyping")}
        hint={t("display.keepHeaderWhenTypingHint")}
        htmlFor="pref-keep-header-when-typing"
        control={
          <Switch
            id="pref-keep-header-when-typing"
            checked={prefs.keepHeaderWhenTyping}
            onCheckedChange={setKeepHeaderWhenTyping}
            aria-label={t("display.keepHeaderWhenTyping")}
          />
        }
      />
      <Row
        label={t("display.hideControlsWhenTyping")}
        hint={t("display.hideControlsWhenTypingHint")}
        htmlFor="pref-hide-controls-when-typing"
        control={
          <Switch
            id="pref-hide-controls-when-typing"
            checked={prefs.hideControlsWhenTyping}
            onCheckedChange={setHideControlsWhenTyping}
            aria-label={t("display.hideControlsWhenTyping")}
          />
        }
      />
      <Row
        label={t("display.rawTerminal")}
        hint={t("display.rawTerminalHint")}
        htmlFor="pref-raw"
        control={
          <Switch
            id="pref-raw"
            checked={prefs.rawTerminal}
            onCheckedChange={setRawTerminal}
            aria-label={t("display.rawTerminal")}
          />
        }
      />
      <Row
        label={t("display.textSize")}
        control={
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              disabled={prefs.fontSize <= FONT_MIN}
              onClick={() => stepFontSize(-1)}
              aria-label={t("display.decreaseFont")}
            >
              <AArrowDown className="size-4" />
            </Button>
            <span className="w-8 text-center font-mono text-xs tabular-nums text-muted-foreground">
              {prefs.fontSize}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              disabled={prefs.fontSize >= FONT_MAX}
              onClick={() => stepFontSize(1)}
              aria-label={t("display.increaseFont")}
            >
              <AArrowUp className="size-4" />
            </Button>
          </div>
        }
      />
    </div>
  );
}
