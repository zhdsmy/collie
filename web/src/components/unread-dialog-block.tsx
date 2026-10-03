import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  lineText,
  type StyledLine,
  type UnreadDialogBlock as UnreadBlock,
  type UnreadDialogModel,
} from "@/lib/blocks";
import { keyLabel } from "@/lib/key-queue";
import { OptionGroupCaption, PromptPanel } from "@/components/option-button";
import { RawMirror } from "@/components/raw-mirror";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";

export interface UnreadDialogBlockProps {
  /** The screen no grammar read, and the key its harness DECLARED as the way out (.adr/0053). */
  cancel: UnreadDialogModel;
  lines: StyledLine[];
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
// ARM, THEN SEND (#339). The declared key is sent on the SECOND tap. A screen this card could not
// read may be a question dialog whose Escape ends the whole turn (opencode's `esc dismiss`), and
// the first tap must not be able to do that. The first tap only arms: the caption changes
// (never its size), and it disarms by itself after ARM_MS. The wording names "Dismiss" only when
// the screen's own rows print `esc dismiss`; otherwise it names the key, never a verb.
export const ARM_MS = 4000;
const NAMES_A_DISMISS = /\besc\s+dismiss\b/i;

export function UnreadDialogBlock({ cancel, lines, viewport, onAction, disabled }: UnreadDialogBlockProps) {
  useLocale();
  const [sending, setSending] = useState(false);
  const locked = disabled || sending;
  // The arm belongs to ONE dialog: it records the identity it was armed for, so a new dialog (other
  // key, other rows, or another pane reusing this instance) is never armed by the old one's tap.
  const identity = `${cancel.key}\n${lines.map(lineText).join("\n")}`;
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const armed = armedFor === identity;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const caption = viewport?.title ?? t("unreadDialog.caption");
  const dismissWording = lines.some((l) => NAMES_A_DISMISS.test(lineText(l)));

  useEffect(() => () => clearTimeout(timer.current), []);
  // A changed dialog or a card that stops being pressable also stops being armed.
  useEffect(() => {
    clearTimeout(timer.current);
    setArmedFor(null);
  }, [disabled, identity]);

  async function press() {
    if (locked) return;
    if (!armed) {
      setArmedFor(identity);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmedFor(null), ARM_MS);
      return;
    }
    clearTimeout(timer.current);
    setArmedFor(null);
    setSending(true);
    try {
      await onAction(cancel.key);
    } finally {
      setSending(false);
    }
  }

  const armedLabel = dismissWording
    ? t("unreadDialog.confirmDismiss")
    : t("unreadDialog.confirmKey", { key: keyLabel(cancel.key) });

  return (
    <PromptPanel
      ariaLabel={caption}
      className={viewport ? "h-[min(20rem,calc(var(--card-dock-max-height,55dvh)-2rem))] min-h-0" : "py-0.5"}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0 [&>div>span:last-child]:truncate" title={armed ? armedLabel : caption}>
          <OptionGroupCaption>{armed ? armedLabel : caption}</OptionGroupCaption>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={locked}
          aria-busy={sending}
          aria-label={armed ? armedLabel : keyLabel(cancel.key)}
          onClick={press}
          className="font-content min-h-11 min-w-11 shrink-0 px-1 py-0 text-muted-foreground"
        >
          <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
            sending || armed ? "border-primary bg-primary/15" : "border-border bg-muted/40")}>{keyLabel(cancel.key)}</span>
        </Button>
      </div>
      {viewport && <RawMirror
        key={viewport.title}
        lines={viewport.lines}
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]"
      />}
      <span role="status" className="sr-only">
        {armed ? armedLabel : ""}
      </span>
    </PromptPanel>
  );
}
