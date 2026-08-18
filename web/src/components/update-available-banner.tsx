import { ArrowUpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { checkForUpdate } from "@/lib/pwa";
import { useSelfUpdate } from "@/lib/self-update";

// Slim persistent "New version — tap to update" row, the fallback for when the self-updater is
// confirmed-stale but can't auto-update right now — the user has unsent work (an open composer draft,
// an in-flight upload, an open action sheet) or we already auto-updated once for this build. An
// in-flow row (not an overlay) that stacks above the route in RootLayout's flex column rather than
// covering the sticky header. Shares the top-band idiom with the ConnectionBanner — text-xs and one
// truncating row. The first visible band owns the safe-area inset; index.css removes it from any row
// or route header stacked below, so the notch height is never repeated.
//
// Mounted unconditionally so useSelfUpdate() runs the controller for its whole lifetime — the
// auto-update path runs even while this returns null (banner hidden). Tapping takes the same update
// path as the footer button and the auto-path: checkForUpdate() reloads onto the fresh bundle
// (SW update→activate→reload, or a plain reload when no SW controls the page).
export function UpdateAvailableBanner() {
  const { t } = useTranslation();
  const show = useSelfUpdate();
  if (!show) return null;

  return (
    <button
      data-top-banner
      type="button"
      onClick={() => void checkForUpdate()}
      className="app-top-banner-row flex w-full shrink-0 items-center gap-2 border-b border-status-working/40 bg-status-working/15 px-4 py-1.5 text-left text-xs font-medium text-foreground [--app-top-row-pad:0.375rem] [padding-top:calc(env(safe-area-inset-top)_+_var(--app-top-row-pad))]"
    >
      <ArrowUpCircle className="size-3.5 shrink-0 text-status-working" />
      <span className="min-w-0 flex-1 truncate">{t("updates.newVersion")}</span>
    </button>
  );
}
