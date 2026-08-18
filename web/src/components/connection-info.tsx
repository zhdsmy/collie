import type { ReactNode } from "react";
import { Plug } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { Card } from "@/components/ui/card";
import type { BridgeStatus, DeviceAuth } from "@/lib/types";

// A small read-only diagnostics panel for Settings: where this client is connected, whether it's a
// secure context (PWA/push need one), the live bridge status, and — when per-device auth is on —
// this device's access level. Reads browser globals (location / isSecureContext); the bridge +
// device come from the polled snapshot (HomeData). Nothing here is configurable; it's for "why
// isn't X working" triage.
export function ConnectionInfo({
  bridge,
  device,
  build,
}: {
  bridge: BridgeStatus | undefined;
  device: DeviceAuth | undefined;
  /** Build id the bridge reports it's serving (from /api/config); omitted while loading/offline. */
  build?: string;
}) {
  const { t } = useTranslation();
  const b = bridgeLabel(bridge, t);
  const d = deviceLabel(device, t);
  const secure = typeof window !== "undefined" && window.isSecureContext;
  const host = typeof window !== "undefined" ? window.location.host : "—";

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-3 p-4 pb-3">
        <Plug className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <div className="font-medium">{t("connection.title")}</div>
          <p className="text-sm text-muted-foreground">
            {t("connection.diagnosticsDescription")}
          </p>
        </div>
      </div>
      <dl className="divide-y divide-border/60 border-t border-border/60">
        <Row label={t("connection.endpoint")}>{host}</Row>
        <Row label={t("connection.secureContext")}>
          {secure ? t("common.yes") : t("connection.noPlainHttp")}
        </Row>
        <Row label={t("connection.bridge")}>
          <span className={b.tone}>{b.text}</span>
        </Row>
        <Row label={t("connection.deviceAccess")}>
          <span className={d.tone}>{d.text}</span>
        </Row>
        {/* Always present, even before the value lands: appearing late grew this card and moved
            everything under it. An em dash is a truthful "not known yet" and the same height. */}
        <Row label={t("connection.serverBuild")}>{build ?? "—"}</Row>
      </dl>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-[13px]">{children}</dd>
    </div>
  );
}

function bridgeLabel(bridge: BridgeStatus | undefined, t: TFunction): { text: string; tone: string } {
  if (bridge === "connected") return { text: t("common.connected"), tone: "text-status-done" };
  if (bridge === "disconnected") {
    return { text: t("connection.bridgeOffline"), tone: "text-status-working" };
  }
  return { text: t("common.connecting"), tone: "text-muted-foreground" };
}

// Mirrors the deviceAuth matrix on the bridge (see bridge/server.ts). "Local" = an authorised request
// with no device header, i.e. the on-host loopback operator.
function deviceLabel(device: DeviceAuth | undefined, t: TFunction): { text: string; tone: string } {
  if (!device || !device.enforced) {
    return { text: t("connection.notEnforced"), tone: "text-muted-foreground" };
  }
  if (device.authorized) {
    return {
      text: device.device
        ? t("connection.fullAccessDevice", { device: device.device })
        : t("connection.fullAccessLocal"),
      tone: "text-status-done",
    };
  }
  return {
    text: device.device
      ? t("connection.readOnlyDevice", { device: device.device })
      : t("connection.readOnly"),
    tone: "text-status-working",
  };
}
