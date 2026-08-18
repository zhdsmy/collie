import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/i18n";
import {
  disablePush,
  enablePush,
  getPushState,
  isPushDisabledByUser,
  type EnableResult,
  type PushState,
} from "@/lib/push";

// On mount, and whenever the resolved UI language changes, subscribe/update Web Push unless the user
// turned it off in Settings. Best-effort and silent: service workers + Push need a secure context, so
// over plain HTTP this no-ops. Re-registering the same endpoint updates its notification locale.
export function usePushSetup() {
  const { resolved } = useLanguage();
  useEffect(() => {
    if (isPushDisabledByUser()) return;
    let cancelled = false;
    void (async () => {
      try {
        await enablePush();
      } catch (e) {
        if (!cancelled) console.warn("[push] setup skipped:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolved]);
}

// Settings-page controller: the current push state plus an enable/disable action that refreshes it.
export function usePushControl() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (enabled: boolean): Promise<EnableResult> => {
      setBusy(true);
      try {
        if (enabled) {
          const res = await enablePush();
          await refresh();
          return res;
        }
        await disablePush();
        await refresh();
        return { ok: true };
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { state, busy, setEnabled };
}
