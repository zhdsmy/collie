import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Info, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { clearStatus, useStatus, type StatusTone } from "@/lib/status";
import { t } from "@/lib/i18n";
import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";

/**
 * The pane screen's status (lib/status.ts), living in the header's TITLE SLOT instead of floating
 * over the tab strip.
 *
 * It used to be a `<ToastViewport dock="top">` absolute over the content region — chosen, per that
 * file's own doc, because the bottom of this screen is the composer. That argument was sound and
 * still is; the flaw was the other end of the trade. "Top" on the pane screen is the tab strip and
 * the pane strip, and the tab strip's own "+" (new tab) sits exactly there — so the FIRST status a
 * new tab ever earns ("Tab ready") landed on the control the operator had just tapped to make it.
 * The strip was never free real estate; it is where the control you just pressed lives.
 *
 * The header title, by contrast, is text nobody is reading in the two seconds a status shows —
 * the pane's own name and path sit still, unread, the whole time an agent is running — and the
 * controls beside it (back, the ⋮ menu) never move, because this component only ever swaps what
 * `RouteHeader`'s `children` slot receives. Same box, same height: whichever of `children` or the
 * status text is showing, the box around it is the caller's own (the pane's identity button already
 * states `min-h-11`), so the header never grows or shrinks to say a word passed.
 *
 * Zen mode has no header row at all, so it keeps the old bottom-docked `ToastViewport` — there is
 * no title slot to ride in there. This component is the pane screen's non-zen path only.
 */
const TONE = {
  info: "text-muted-foreground",
  success: "text-status-done",
  warn: "text-status-working",
  error: "text-status-blocked",
} satisfies Record<StatusTone, string>;

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  error: AlertCircle,
} as const;

export function HeaderStatus({ children }: { children: ReactNode }) {
  useLocale();
  const status = useStatus();
  const [detailId, setDetailId] = useState<number | null>(null);
  const messageId = useId();
  if (!status) return <>{children}</>;
  const Icon = ICONS[status.tone];
  // Keep the header's height fixed; tapping an error opens its full text instead of losing it.
  const dismissable = status.tone === "error";
  const detailsOpen = dismissable && detailId === status.id;
  return (
    <>
      <div
        key={status.id}
        data-slot="header-status"
        className={cn("relative flex min-h-11 min-w-0 flex-1 items-center", dismissable && "pointer-events-auto")}
      >
        {/* `<output>` carries an implicit ARIA role of "status" — the same announcement contract
            StatusArea's own `<output>` made, kept verbatim. */}
        <output
          aria-live="polite"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold",
            TONE[status.tone],
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span id={messageId} className="truncate">{status.text}</span>
          {dismissable && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
        </output>
        {dismissable && (
          <button
            type="button"
            aria-label={t("status.errorDetails")}
            aria-describedby={messageId}
            aria-haspopup="dialog"
            aria-expanded={detailsOpen}
            title={status.text}
            onClick={() => setDetailId(status.id)}
            className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        )}
      </div>
      {dismissable && createPortal(
        <BottomSheet open={detailsOpen} onClose={() => setDetailId(null)} title={t("status.errorDetails")}>
          <p data-slot="status-details-text" className="whitespace-pre-wrap break-words text-sm leading-relaxed select-text">
            {status.text}
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => clearStatus()}>
            <X className="size-4" />
            {t("status.dismissAria")}
          </Button>
        </BottomSheet>,
        document.body,
      )}
    </>
  );
}
