import type { NotifData, PushDecision } from "./push-decision";

/** The browser notification operations, kept injectable for delivery regression tests. */
interface NotificationDisplay {
  getNotifications(filter: { tag: string }): Promise<readonly { close(): void }[]>;
  showNotification(title: string, options: NotificationOptions): Promise<void>;
}

// Use the unpadded artwork for the icon and the transparent silhouette for Android's badge.
const ICON = "/notification-icon-192x192.png";
const BADGE = "/badge-96x96.png";

export async function displayPush(decision: PushDecision, target: NotificationDisplay): Promise<void> {
  if (decision.kind === "suppress") return;
  if (decision.kind === "clear") {
    const stale = await target.getNotifications({ tag: decision.tag });
    for (const notification of stale) notification.close();
    return;
  }
  // A retraction may update an existing alert, never recreate one already dismissed or suppressed.
  if (decision.silent && (await target.getNotifications({ tag: decision.tag })).length === 0) return;
  const options: NotificationOptions & { renotify: boolean; silent: boolean } = {
    body: decision.body,
    data: {
      paneId: decision.paneId,
      session: decision.session,
      host: decision.host,
      target: decision.target,
    } satisfies NotifData,
    icon: ICON,
    badge: BADGE,
    tag: decision.tag,
    renotify: decision.renotify,
    // renotify alone is only a replacement hint, not a request for silent delivery on WebKit.
    silent: decision.silent,
  };
  await target.showNotification(decision.title, options);
}
