import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useLocale } from "@/hooks/use-locale";
import { t } from "@/lib/i18n";
import { keysSendable } from "@/lib/mux-capability";
import { composeKey, MODIFIER_ORDER } from "@/lib/key-queue";
import {
  ArrowBigUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  ChevronUp,
  CornerDownLeft,
  Keyboard,
  LockKeyhole,
  Option,
  SquareFunction,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useHoldRepeat } from "@/hooks/use-hold-repeat";
import type { DirectKeyRow, DirectModifierState } from "@/hooks/use-direct-typing";
import type { Modifier } from "@/lib/key-queue";
import { cn } from "@/lib/utils";

interface DirectKeyboardAccessoryProps {
  row: DirectKeyRow;
  modifiers: DirectModifierState;
  disabled?: boolean;
  unsupportedKeys?: readonly string[];
  onToggleRow: () => void;
  onToggleModifier: (modifier: Modifier) => void;
  onSendKeys: (keys: string[]) => void;
}

const FUNCTION_KEYS = Array.from({ length: 12 }, (_, index) => `F${index + 1}`);

const NAVIGATION_KEYS: ReadonlyArray<{
  key: string;
  icon: LucideIcon;
  ariaLabel: string;
  repeatable?: boolean;
}> = [
  { key: "Escape", icon: X, ariaLabel: "Escape" },
  { key: "Tab", icon: ArrowRightToLine, ariaLabel: "Tab" },
  { key: "Up", icon: ArrowUp, ariaLabel: "Up", repeatable: true },
  { key: "Down", icon: ArrowDown, ariaLabel: "Down", repeatable: true },
  { key: "Left", icon: ArrowLeft, ariaLabel: "Left", repeatable: true },
  { key: "Right", icon: ArrowRight, ariaLabel: "Right", repeatable: true },
  { key: "Enter", icon: CornerDownLeft, ariaLabel: "Enter" },
];

const KEY_ICON_CLASS = "size-[18px] shrink-0";
const RESTING_KEY_CLASS =
  "border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground";
const NO_REFUSED_KEYS: readonly string[] = [];

function preserveTextareaFocus(event: ReactPointerEvent<HTMLButtonElement>) {
  event.preventDefault();
}

export function DirectKeyboardAccessory({
  row,
  modifiers,
  disabled = false,
  unsupportedKeys = NO_REFUSED_KEYS,
  onToggleRow,
  onToggleModifier,
  onSendKeys,
}: DirectKeyboardAccessoryProps) {
  useLocale();
  const activeModifiers = MODIFIER_ORDER.filter((modifier) => modifiers[modifier] !== "off");
  const repeat = useHoldRepeat(
    async (key, count) => {
      onSendKeys(Array<string>(count).fill(key));
      return true;
    },
    !disabled,
  );

  const modifierButton = (modifier: Modifier, Icon: LucideIcon, label: string) => {
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
        title={label}
        aria-pressed={mode !== "off"}
        data-mode={mode}
        className={cn(
          "relative size-11 shrink-0 touch-manipulation px-0",
          mode === "off" && RESTING_KEY_CLASS,
        )}
      >
        <Icon aria-hidden="true" className={KEY_ICON_CLASS} />
        {mode === "locked" && (
          <LockKeyhole aria-hidden="true" className="absolute right-1 top-1 size-2.5" />
        )}
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
    const refused = !keysSendable([composeKey(activeModifiers, key)], unsupportedKeys);
    const binding = repeatable ? repeat.bind(key, () => onSendKeys([key])) : undefined;
    return (
      <Button
        key={key}
        type="button"
        variant={held ? "default" : "outline"}
        size="sm"
        disabled={disabled || refused}
        {...(binding ?? { onClick: () => onSendKeys([key]) })}
        onPointerDown={(event) => {
          preserveTextareaFocus(event);
          if (!refused) binding?.onPointerDown(event);
        }}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={cn(
          "size-11 shrink-0 touch-manipulation select-none px-0 text-xs",
          !held && RESTING_KEY_CLASS,
        )}
      >
        {held ? (
          <span className="relative flex items-center">
            {label}
            {repeat.count > 1 && (
              <span className="absolute -right-2 -top-2 font-mono text-[9px] tabular-nums">×{repeat.count}</span>
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
      className="mb-2 flex min-w-0 items-center gap-1.5 border-y border-rule px-1.5 py-1.5"
    >
      <Button
        type="button"
        variant="outline"
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
        className={cn("size-11 shrink-0 touch-manipulation", RESTING_KEY_CLASS)}
      >
        {row === "navigation" ? (
          <SquareFunction aria-hidden="true" className={KEY_ICON_CLASS} />
        ) : (
          <Keyboard aria-hidden="true" className={KEY_ICON_CLASS} />
        )}
      </Button>
      <div aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />
      <div
        key={row}
        data-testid="direct-key-rail"
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain pr-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {row === "navigation" ? (
          <>
            {modifierButton("ctrl", ChevronUp, "Ctrl")}
            {NAVIGATION_KEYS.map(({ key, icon: Icon, ariaLabel, repeatable }) =>
              keyButton(
                key,
                <Icon aria-hidden="true" className={KEY_ICON_CLASS} />,
                ariaLabel,
                repeatable,
              ),
            )}
            {modifierButton("shift", ArrowBigUp, "Shift")}
            {modifierButton("alt", Option, "Alt")}
          </>
        ) : (
          FUNCTION_KEYS.map((key) => keyButton(key, key, key))
        )}
      </div>
    </div>
  );
}
