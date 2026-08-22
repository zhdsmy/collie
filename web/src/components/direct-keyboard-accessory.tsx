import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Lock, Move } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHoldRepeat } from "@/hooks/use-hold-repeat";
import type { DirectKeyRow, DirectModifierState } from "@/hooks/use-direct-typing";
import type { Modifier } from "@/lib/key-queue";
import { cn } from "@/lib/utils";

interface DirectKeyboardAccessoryProps {
  row: DirectKeyRow;
  modifiers: DirectModifierState;
  disabled?: boolean;
  onToggleRow: () => void;
  onToggleModifier: (modifier: Modifier) => void;
  onSendKeys: (keys: string[]) => void;
}

const FUNCTION_KEYS = Array.from({ length: 12 }, (_, index) => `F${index + 1}`);

const NAVIGATION_KEYS: ReadonlyArray<{
  key: string;
  label: ReactNode;
  ariaLabel: string;
  repeatable?: boolean;
}> = [
  { key: "Escape", label: "Esc", ariaLabel: "Escape" },
  { key: "Tab", label: "Tab", ariaLabel: "Tab" },
  { key: "Left", label: <ArrowLeft className="size-4" />, ariaLabel: "Left", repeatable: true },
  { key: "Up", label: <ArrowUp className="size-4" />, ariaLabel: "Up", repeatable: true },
  { key: "Down", label: <ArrowDown className="size-4" />, ariaLabel: "Down", repeatable: true },
  { key: "Right", label: <ArrowRight className="size-4" />, ariaLabel: "Right", repeatable: true },
];

export function DirectKeyboardAccessory({
  row,
  modifiers,
  disabled = false,
  onToggleRow,
  onToggleModifier,
  onSendKeys,
}: DirectKeyboardAccessoryProps) {
  const { t } = useTranslation();
  const repeat = useHoldRepeat(
    async (key, count) => {
      onSendKeys(Array<string>(count).fill(key));
      return true;
    },
    !disabled,
  );

  const preserveTextareaFocus = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const modifierButton = (modifier: Modifier, label: string) => {
    const mode = modifiers[modifier];
    return (
      <Button
        key={modifier}
        type="button"
        variant={mode === "off" ? "outline" : "default"}
        size="sm"
        disabled={disabled}
        onPointerDown={preserveTextareaFocus}
        onClick={() => onToggleModifier(modifier)}
        aria-label={label}
        aria-pressed={mode !== "off"}
        data-mode={mode}
        className="h-10 min-w-[4.25rem] touch-manipulation gap-1 px-2 text-xs"
      >
        {mode === "locked" && <Lock className="size-3" />}
        {label}
      </Button>
    );
  };

  const keyButton = (
    key: string,
    label: ReactNode,
    ariaLabel: string,
    repeatable = false,
  ) => {
    const held = repeatable && repeat.holding === key;
    const binding = repeatable ? repeat.bind(key, () => onSendKeys([key])) : undefined;
    return (
      <Button
        key={key}
        type="button"
        variant={held ? "default" : "outline"}
        size="sm"
        disabled={disabled}
        {...(binding ?? { onClick: () => onSendKeys([key]) })}
        onPointerDown={(event) => {
          preserveTextareaFocus(event);
          binding?.onPointerDown(event);
        }}
        aria-label={ariaLabel}
        className={cn(
          "h-10 min-w-12 touch-manipulation select-none px-2 text-xs",
          repeatable && "w-10 min-w-10 px-0",
        )}
      >
        {held ? (
          <span className="flex items-center gap-1">
            {label}
            {repeat.count > 1 && (
              <span className="font-mono text-[10px] tabular-nums">×{repeat.count}</span>
            )}
          </span>
        ) : (
          label
        )}
      </Button>
    );
  };

  return (
    <div
      data-testid="direct-keyboard-accessory"
      className="mb-2 flex min-w-0 items-center gap-1.5 border-y border-border/60 bg-background/50 py-1.5"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onPointerDown={preserveTextareaFocus}
        onClick={onToggleRow}
        aria-label={
          row === "navigation" ? t("keys.showFunctionKeys") : t("keys.showNavigationKeys")
        }
        title={
          row === "navigation" ? t("keys.showFunctionKeys") : t("keys.showNavigationKeys")
        }
        className="size-10 shrink-0 touch-manipulation border border-border/60 bg-muted/40"
      >
        {row === "navigation" ? (
          <span className="font-mono text-xs font-semibold">
            F<span className="text-[9px]">x</span>
          </span>
        ) : (
          <Move className="size-4" />
        )}
      </Button>
      <div aria-hidden="true" className="h-7 w-px shrink-0 bg-border/70" />
      <div
        key={row}
        data-testid="direct-key-rail"
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {row === "navigation" ? (
          <>
            {modifierButton("ctrl", "Ctrl")}
            {modifierButton("alt", "Alt")}
            {modifierButton("shift", "Shift")}
            {NAVIGATION_KEYS.map((item) =>
              keyButton(item.key, item.label, item.ariaLabel, item.repeatable),
            )}
          </>
        ) : (
          FUNCTION_KEYS.map((key) => keyButton(key, key, key))
        )}
      </div>
    </div>
  );
}
