import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
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
  CircleArrowOutUpLeft,
  Combine,
  CornerDownLeft,
  Keyboard,
  LockKeyhole,
  Option,
  SquareFunction,
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

// Whole chords a terminal agent asks for often enough to deserve one tap: Claude's and Codex's mode
// cycle, a selection step left, and interrupt. Already composed, so a latched modifier neither
// applies to them nor is spent by them (composeKey leaves a `+` chord alone).
const COMBO_KEYS: ReadonlyArray<{ key: string; label: string; ariaLabel: string }> = [
  { key: "shift+Tab", label: "⇧Tab", ariaLabel: "Shift+Tab" },
  { key: "shift+Left", label: "⇧←", ariaLabel: "Shift+Left" },
  { key: "ctrl+c", label: "^C", ariaLabel: "Ctrl+C" },
];

/**
 * The switch's face per row, in the order it walks them (use-direct-typing.ts ROW_ORDER): the icon
 * of the row you are ON, and the sentence for the tap, which names the row it leads to. The dots
 * under the icon say which of the three pages this is.
 */
const ROWS: ReadonlyArray<{ row: DirectKeyRow; icon: LucideIcon; next: () => string }> = [
  { row: "navigation", icon: Keyboard, next: () => t("keys.showComboKeys") },
  { row: "combos", icon: Combine, next: () => t("keys.showFunctionKeys") },
  { row: "function", icon: SquareFunction, next: () => t("keys.showNavigationKeys") },
];

/** A latched modifier as the switch shows it on the pages that have no modifier keys. The glyphs
 *  match the Ctrl key's chevron and the combos' `⇧`; the names are the key caps, untranslated. */
const MODIFIER_MARK = {
  ctrl: { glyph: "^", name: "Ctrl" },
  alt: { glyph: "⌥", name: "Alt" },
  shift: { glyph: "⇧", name: "Shift" },
} satisfies Record<Modifier, { glyph: string; name: string }>;

const NAVIGATION_KEYS: ReadonlyArray<{
  key: string;
  icon: LucideIcon;
  ariaLabel: string;
  label?: string;
  repeatable?: boolean;
}> = [
  { key: "Escape", icon: CircleArrowOutUpLeft, ariaLabel: "Escape", label: "Esc" },
  { key: "Tab", icon: ArrowRightToLine, ariaLabel: "Tab", label: "Tab" },
  { key: "Up", icon: ArrowUp, ariaLabel: "Up", repeatable: true },
  { key: "Down", icon: ArrowDown, ariaLabel: "Down", repeatable: true },
  { key: "Left", icon: ArrowLeft, ariaLabel: "Left", repeatable: true },
  { key: "Right", icon: ArrowRight, ariaLabel: "Right", repeatable: true },
  { key: "Enter", icon: CornerDownLeft, ariaLabel: "Enter", label: "Enter" },
];

const KEY_ICON_CLASS = "size-[18px] shrink-0";
const RESTING_KEY_CLASS =
  "border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground";
const NO_REFUSED_KEYS: readonly string[] = [];

function preserveTextareaFocus(event: ReactMouseEvent<HTMLButtonElement>) {
  // Cancel the focus-changing mouse default, not pointerdown: WebKit drops a touch's click
  // when pointerdown is cancelled, making the key appear tappable but send nothing.
  event.preventDefault();
}

function KeyLegend({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span aria-hidden="true" className="flex flex-col items-center gap-0.5">
      <Icon className={KEY_ICON_CLASS} />
      <span className="text-[10px] font-medium leading-3">{label}</span>
    </span>
  );
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
  const here = ROWS.find((r) => r.row === row)!;
  const HereIcon = here.icon;
  const activeModifiers = MODIFIER_ORDER.filter((modifier) => modifiers[modifier] !== "off");
  // The modifier keys sit on the navigation page alone, yet a latched one still applies to what the
  // phone keyboard types on the other two: a stray one-shot Ctrl turns a typed `d` into ctrl+d. The
  // switch carries it there, where it would otherwise be invisible.
  const carried = row === "navigation" ? [] : activeModifiers;
  const switchLabel =
    carried.length === 0
      ? here.next()
      : `${here.next()} · ${carried.map((m) => MODIFIER_MARK[m].name).join("+")}`;
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
        onMouseDown={preserveTextareaFocus}
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
        <KeyLegend icon={Icon} label={label} />
        {mode === "locked" && (
          <LockKeyhole aria-hidden="true" className="absolute right-0.5 top-0.5 size-2" />
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
        onMouseDown={preserveTextareaFocus}
        onPointerDown={(event) => {
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
        onMouseDown={preserveTextareaFocus}
        onClick={onToggleRow}
        aria-label={switchLabel}
        title={switchLabel}
        className={cn("relative size-11 shrink-0 touch-manipulation", RESTING_KEY_CLASS)}
      >
        {carried.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 rounded-sm bg-primary px-[3px] text-[10px] font-semibold leading-3 text-primary-foreground"
          >
            {carried.map((m) => MODIFIER_MARK[m].glyph).join("")}
          </span>
        )}
        <span aria-hidden="true" className="flex flex-col items-center gap-1">
          <HereIcon className={KEY_ICON_CLASS} />
          <span className="flex gap-1">
            {ROWS.map((r) => (
              <span
                key={r.row}
                data-current={r.row === row || undefined}
                className={cn("size-1 rounded-full bg-current", r.row !== row && "opacity-30")}
              />
            ))}
          </span>
        </span>
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
            {NAVIGATION_KEYS.map(({ key, icon: Icon, ariaLabel, label, repeatable }) =>
              keyButton(
                key,
                label ? (
                  <KeyLegend icon={Icon} label={label} />
                ) : (
                  <Icon aria-hidden="true" className={KEY_ICON_CLASS} strokeWidth={2.5} />
                ),
                ariaLabel,
                repeatable,
              ),
            )}
            {modifierButton("shift", ArrowBigUp, "Shift")}
            {modifierButton("alt", Option, "Alt")}
          </>
        ) : row === "function" ? (
          FUNCTION_KEYS.map((key) => keyButton(key, key, key))
        ) : (
          COMBO_KEYS.map(({ key, label, ariaLabel }) => keyButton(key, label, ariaLabel))
        )}
      </div>
    </div>
  );
}
