import { useState } from "react";

import { cn } from "@/lib/utils";
import type { UnreadDialogBlock as UnreadBlock, UnreadDialogModel } from "@/lib/blocks";
import { keyLabel } from "@/lib/key-queue";
import { OptionGroupCaption, PromptPanel } from "@/components/option-button";
import { RawMirror } from "@/components/raw-mirror";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

export interface UnreadDialogBlockProps {
  /** The screen no grammar read, and the key its harness DECLARED as the way out (.adr/0053). */
  cancel: UnreadDialogModel;
  viewport?: UnreadBlock["viewport"];
  /**
   * Injected send handler (from AgentChat). Presentational contract: this component NEVER touches
   * the network — the race guard and the send live in lib/unread-dialog-action.ts's caller.
   */
  onAction: (key: string) => void | Promise<void>;
  /** Read-only device or a gone pane: everything renders (for context) but can't be pressed. */
  disabled?: boolean;
}

// The UNREAD-DIALOG CARD — one declared key over a screen Collie could not read (.adr/0053).
//
// This is the least confident block in the family and it must look it. It claims nothing about the
// screen: no title lifted, no options, no footer parsed. The caption says what is true ("Collie did
// not recognize this interface") and the single button says only the KEY, never what the key does —
// on Muse that key steps back rather than dismisses, so a label promising "cancel" would be a lie on
// a real harness.
//
// Unknown screens keep the compact caption/key row. Identified native screens can carry their own
// region in a fixed viewport; the body scrolls independently of the header and Escape control.
//
// DESIGN.md §2: the in-flight state recolours the button and changes NOTHING else — no spinner child
// appears, no border is added, no padding moves. The border is reserved in the base string and the
// pending state only repaints it, so the card the operator is reading does not shift under the tap.
// DESIGN.md §6: `min-h-11` is the 44px tap floor, stated as a floor and never a fixed height.
export function UnreadDialogBlock({ cancel, viewport, onAction, disabled }: UnreadDialogBlockProps) {
  useLocale();
  const [sending, setSending] = useState(false);
  const locked = disabled || sending;
  const caption = viewport?.title ?? t("unreadDialog.caption");

  async function press() {
    if (locked) return;
    setSending(true);
    try {
      await onAction(cancel.key);
    } finally {
      setSending(false);
    }
  }

  return (
    <PromptPanel
      ariaLabel={caption}
      className={viewport ? "h-[min(20rem,calc(var(--card-dock-max-height,55dvh)-2rem))] min-h-0" : "py-0.5"}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0 [&>div>span:last-child]:truncate" title={caption}>
          <OptionGroupCaption>{caption}</OptionGroupCaption>
        </div>
        <button
          type="button"
          disabled={locked}
          aria-busy={sending}
          onClick={press}
          className={cn(
            "font-content flex min-h-11 shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-foreground transition-colors disabled:opacity-60",
            sending ? "border-primary bg-primary/25" : "border-primary/60 bg-primary/15 active:bg-primary/25",
          )}
        >
          {keyLabel(cancel.key)}
        </button>
      </div>
      {viewport && <RawMirror
        key={viewport.title}
        lines={viewport.lines}
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]"
      />}
    </PromptPanel>
  );
}
