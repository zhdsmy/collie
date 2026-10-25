import { readFileSync } from "node:fs";
import { join } from "node:path";
import { asJsonObject, asJsonString, parseJson } from "../web/src/lib/json.ts";
import { compareSemver } from "../web/src/lib/semver.ts";
import type { ProfileMatch } from "../web/src/lib/surface/profile.ts";

export type AgyQueuedMessagesMode = "queue" | "send-immediately";

/**
 * Read Antigravity CLI's `queuedMessages` setting from the first readable `settings.json`
 * under `agyRoots` (defaulting to `~/.gemini/antigravity-cli/settings.json`).
 *
 * When unset or unreadable, Antigravity CLI defaults to `"queue"`.
 */
export function readAgyQueuedMessagesMode(agyRoots: readonly string[] | undefined): AgyQueuedMessagesMode {
  for (const root of agyRoots ?? []) {
    try {
      const raw = readFileSync(join(root, "settings.json"), "utf8");
      const mode = asJsonString(asJsonObject(parseJson(raw))?.queuedMessages);
      if (mode === "send-immediately" || mode === "queue") return mode;
      return "queue";
    } catch {
      continue;
    }
  }
  return "queue";
}

/**
 * Align the resolved `agy` send profile with the host's `~/.gemini/antigravity-cli/settings.json`:
 *
 * - `"queue"` (default): `Enter` queues while a turn runs, and `alt+m` steers (`Send Immediately`).
 * - `"send-immediately"`: `Enter` steers while a turn runs, and `alt+m` queues (`Queue`).
 */
export function applyAgySendSettings(
  match: ProfileMatch | null,
  agyRoots: readonly string[] | undefined,
): ProfileMatch | null {
  if (match === null || match.profile.id !== "agy" || match.version === null) return match;
  const minVersion = match.profile.keys.steerMinVersion;
  if (minVersion !== undefined && compareSemver(match.version, minVersion) < 0) return match;
  if (readAgyQueuedMessagesMode(agyRoots) !== "send-immediately") return match;
  return {
    ...match,
    profile: {
      ...match.profile,
      keys: {
        ...match.profile.keys,
        enterWhileRunning: "steers",
        queueKey: "alt+m",
        steer: ["Enter"],
      },
    },
  };
}
