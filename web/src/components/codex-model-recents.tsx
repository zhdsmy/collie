import { Check, TerminalSquare, Trash2 } from "lucide-react";

import { ActionRow, DestructiveActionRow } from "@/components/action-sheet-rows";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { useLocale } from "@/hooks/use-locale";
import { usePendingConfirm } from "@/hooks/use-pending-confirm";
import type { CodexModelTarget } from "@/lib/harness/codex/model-field";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The statusline's model switcher: a small menu ABOVE the model it belongs to, listing the
// model/thinking-level pairs this device has actually used, most recent first.
//
// ── WHY IT IS NOT A SHEET ────────────────────────────────────────────────────
// It replaces a bottom sheet, and the sheet is what was wrong: the model field sits in the strip
// welded to the mirror's bottom edge, the answer to "switch back to what I was using" is one tap, and
// a sheet slides up from the same bottom edge — over the very field that was tapped, so the tap's own
// feedback never survives (the argument `ui/anchored-menu.tsx` was built on). Opening upward also
// keeps the trigger on screen, which is the whole point of a control you press twice in a row.
//
// ── TYPE SCALE ───────────────────────────────────────────────────────────────
// Every row is 11px, the statusline's own size, because the model ids are read against the field they
// came from and the operator asked for the two to match. The FAMILY still splits as DESIGN.md §5 says
// it must: a model id is machine-authored and wears `font-mono`; the two chrome rows wear the app
// face. Only the size is shared.

export interface CodexModelRecentsMenuProps {
  open: boolean;
  onClose: () => void;
  /** What the statusline shows right now, so the row in use can be marked. Absent when unreadable. */
  current?: { model: string; effort: string | null };
  recents: readonly CodexModelTarget[];
  onSelect: (target: CodexModelTarget) => void;
  onNative: () => void;
  onRemove: (target: CodexModelTarget) => void;
  onClear: () => void;
  /** The one reason a switch would be refused right now, or absent when it would be accepted. */
  disabledReason?: string;
  busy?: boolean;
}

/**
 * One history row: the pair, and its own delete.
 *
 * Not `ActionRow`, for two reasons that are not styling: the row carries a SECOND control (deleting
 * one entry is its own act, not the row's), and `ActionRow` is itself a `<button>` — nesting one
 * inside it is invalid HTML and a hit-testing trap. So the row is a container holding a grow button
 * and an icon button, side by side. It is the first of its shape in the tree, which is why it lives
 * here rather than in `ui/` (DESIGN.md §1 promotes on the second caller, not the first).
 */
function RecentRow({
  entry,
  selected,
  disabled,
  onSelect,
  onRemove,
}: {
  entry: CodexModelTarget;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 w-full items-center rounded-lg",
        selected ? "bg-muted/60" : "hover:bg-accent",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-current={selected ? "true" : undefined}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left disabled:opacity-60"
      >
        {/* The statusline's own spelling of the pair — `gpt-6-astra xhigh`, not `Extra high`. The
            menu is read against the field it opens from, and a second vocabulary for one value is
            how you end up unable to find the row you are looking at. */}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-none">
          {entry.model} {entry.effort}
        </span>
        {selected ? <Check className="size-3 shrink-0 text-primary" aria-hidden="true" /> : null}
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t("codexModel.removeAria", { model: entry.model, effort: entry.effort })}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive active:bg-muted disabled:opacity-60"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function CodexModelRecentsMenu({
  open,
  onClose,
  current,
  recents,
  onSelect,
  onNative,
  onRemove,
  onClear,
  disabledReason,
  busy = false,
}: CodexModelRecentsMenuProps) {
  useLocale();
  const armed = usePendingConfirm();
  const disabled = busy || disabledReason !== undefined;

  return (
    <AnchoredMenu
      open={open}
      onClose={onClose}
      label={t("codexModel.recentsAria")}
      // Anchored to the LEFT edge of the statusline, where the model field sits, rather than the
      // right edge `AnchoredMenu` defaults to. `right-auto` wins over the base `right-0` because
      // `cn` is tailwind-merge and the two are the same group.
      //
      // The bounds are not decoration: `min-w-44` plus shrink-to-fit plus one long unbreakable model
      // id is a panel wider than a 320px phone, and with the keyboard up the bottom region is ~260px
      // of a ~440px viewport, so a full list would otherwise run off the top.
      className="left-3 right-auto max-h-[45dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain"
    >
      <div className="flex flex-col">
        {recents.map((entry) => (
          <RecentRow
            key={`${entry.model} ${entry.effort}`}
            entry={entry}
            selected={current?.model === entry.model && current.effort === entry.effort}
            disabled={disabled}
            onSelect={() => onSelect(entry)}
            onRemove={() => onRemove(entry)}
          />
        ))}

        <ActionRow
          icon={<TerminalSquare className="size-4 shrink-0" aria-hidden="true" />}
          label={t("codexModel.native")}
          onClick={onNative}
          disabled={disabled}
          className="text-[11px]"
        />

        {recents.length > 0 ? (
          <DestructiveActionRow
            icon={<Trash2 className="size-4 shrink-0" aria-hidden="true" />}
            label={t("codexModel.clearHistory")}
            confirmLabel={t("codexModel.clearHistoryConfirm")}
            closingLabel={t("codexModel.clearHistory")}
            armed={armed.pending === "clear"}
            closing={false}
            disabled={disabled}
            className="text-[11px]"
            onClick={() => {
              // Two taps, like every other destructive row in the app: the first only arms.
              if (armed.confirm("clear")) onClear();
            }}
          />
        ) : null}
      </div>
    </AnchoredMenu>
  );
}
