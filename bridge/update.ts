import { mkdir, rename, writeFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.ts";
import type { UpdateStatus } from "./types.ts";

// Update-availability signal, surfaced on the (access-gated) /api/snapshot as `update`. Two
// independent questions the running plugin can answer about itself:
//
//   • releaseAvailable — is a newer Collie RELEASE published upstream? We read the repo's git tags
//     over anonymous HTTPS (the repo is public) and compare newest `vX.Y.Z[+collie.N]` to the running
//     version. No `git` subprocess (the SSH origin has no agent under systemd --user, and a
//     non-git install has no origin at all), no auth (the 60/hr anonymous limit is irrelevant at a
//     few-hours cadence), and the fetch is trivially injectable for `bun test`.
//   • bridgeStale — is the running bridge PROCESS behind the on-disk bridge source? The frontend
//     build id can't answer this (it's read fresh from disk, so a stale bridge reports the NEW
//     bundle). We stamp the bridge sources at process start and compare; a rebuilt-but-not-restarted
//     bridge (the "#1 my change didn't take" trap) then reads as stale.
//
// The pure pieces (semver compare, tag selection, notify gating, the source stamp) are exported and
// unit-tested; the network + filesystem live behind injected seams on {@link UpdateMonitor}, matching
// the NotificationCoordinator/Snooze injection style.

const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)(?:\+collie\.([1-9]\d*))?$/;
// The upstream tag check is bounded — a hung request must never wedge the monitor's timer.
const TAGS_TIMEOUT_MS = 10_000;
// bridgeStale is read on every snapshot poll; recompute the on-disk stamp at most this often so a
// busy poll loop doesn't stat the source tree dozens of times a second (the value barely changes).
const STALE_TTL_MS = 5_000;

// ── Pure helpers (unit-tested) ────────────────────────────────────────────────

/** Parse a release `vX.Y.Z[+collie.N]` tag into its upstream numeric parts, or null. Prereleases and
 *  any other build metadata are rejected by the anchor. Remote ref names are untrusted input. */
export function parseSemverTag(tag: string): [number, number, number] | null {
  const m = RELEASE_TAG.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

type VersionParts = {
  triple: readonly [number, number, number];
  prerelease: boolean;
  collieRevision: number;
};

/** Numeric upstream triple plus the downstream revision. Generic build metadata remains SemVer-equal;
 *  `+collie.N` is the one project extension that orders Collie's releases on the same upstream base. */
function versionParts(v: string) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]*))?(?:\+([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) {
    return { triple: [0, 0, 0], prerelease: false, collieRevision: 0 } as VersionParts;
  }
  const revision = /^collie\.([1-9]\d*)$/.exec(m[5] ?? "");
  return {
    triple: [Number(m[1]), Number(m[2]), Number(m[3])] as const,
    prerelease: m[4] !== undefined && m[4] !== "",
    collieRevision: revision ? Number(revision[1]) : 0,
  };
}

/**
 * Compare two dotted `X.Y.Z` versions (no leading `v`). Returns -1 / 0 / 1.
 *
 * The running version can be a PRERELEASE (`1.0.0-beta.5`) while every tag we compare it against is
 * a release, so prereleases sort below their release. Collie's `+collie.N` metadata is then compared
 * as a downstream revision; other build metadata remains SemVer-equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (const [x, y] of [
    [pa.triple[0], pb.triple[0]],
    [pa.triple[1], pb.triple[1]],
    [pa.triple[2], pb.triple[2]],
  ] as const) {
    if (x !== y) return x < y ? -1 : 1;
  }
  if (pa.prerelease !== pb.prerelease) return pa.prerelease ? -1 : 1;
  if (pa.collieRevision === pb.collieRevision) return 0;
  return pa.collieRevision < pb.collieRevision ? -1 : 1;
}

/** Whether a selected release is newer than a running version. A downstream candidate makes a
 *  same-line flat current patch (`0.32.13`) readable as its legacy revision (`0.32.0+collie.13`). */
function releaseIsNewer(candidate: string, current: string): boolean {
  const next = versionParts(candidate);
  const running = versionParts(current);
  if (
    next.collieRevision > 0 &&
    running.collieRevision === 0 &&
    next.triple[0] === running.triple[0] &&
    next.triple[1] === running.triple[1]
  ) {
    if (next.triple[2] !== 0) return true;
    return next.collieRevision > running.triple[2];
  }
  return compareSemver(candidate, current) > 0;
}

/** The major of a dotted version (`1.0.0-beta.5` → 1), or null when it names none (`unknown`). */
export function majorOf(version: string): number | null {
  const m = /^(\d+)\./.exec(version.trim());
  return m ? Number(m[1]) : null;
}

/** The newest release WITHIN `major`, dotted, or null — the target a routine `update` may take
 *  (ADR 0020). */
export function latestReleaseInMajor(tags: string[], major: number): string | null {
  return latestReleaseTag(tags.filter((t) => parseSemverTag(t)?.[0] === major));
}

/** The newest release of any major ABOVE `major`, dotted, or null. Crossing to it is consented to by
 *  `update --major`, never inherited — so it is reported separately from {@link latestReleaseInMajor}. */
export function latestReleaseAboveMajor(tags: string[], major: number): string | null {
  return latestReleaseTag(
    tags.filter((t) => {
      const parts = parseSemverTag(t);
      return parts !== null && parts[0] > major;
    }),
  );
}

/** The newest release among `tags`, without its leading `v`, or null. Once a downstream tag exists
 *  on an X.Y line it supersedes that line's legacy flat patch tags; other X.Y lines remain eligible. */
export function latestReleaseTag(tags: string[]): string | null {
  const releases = tags.flatMap((tag) => {
    const trimmed = tag.trim();
    const match = RELEASE_TAG.exec(trimmed);
    if (!match) return [];
    return [{
      version: trimmed.slice(1),
      line: `${match[1]}.${match[2]}`,
      downstream: match[4] !== undefined,
    }];
  });
  const downstreamLines = new Set(
    releases.filter((release) => release.downstream).map((release) => release.line),
  );
  let best: string | null = null;
  for (const release of releases) {
    if (!release.downstream && downstreamLines.has(release.line)) continue;
    if (best === null || compareSemver(release.version, best) > 0) best = release.version;
  }
  return best;
}

/** Whether a NEW-version push should fire: a strictly-newer release we haven't already notified for.
 *  Comparing against `current` (not the raw `latest`) means a restart after updating self-heals — the
 *  new `current` catches up and the condition falls false with no state reset. */
export function shouldNotify(a: {
  current: string;
  latest: string | null;
  lastNotified: string | null;
}): boolean {
  if (!a.latest) return false;
  if (!releaseIsNewer(a.latest, a.current)) return false;
  return a.latest !== a.lastNotified;
}

/** A stable, comparable stamp of source files by (path, mtime, size). Order-independent. Equality is
 *  all we need — any content edit changes size or mtime, and a pull/rebuild touches the changed files. */
export function stampOf(entries: { path: string; mtimeMs: number; size: number }[]): string {
  return [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((e) => `${e.path}:${e.mtimeMs}:${e.size}`)
    .join("\n");
}

// ── Impure seams (injected into the monitor; not unit-tested) ─────────────────

/** Stamp the running bridge's source: every `bridge/*.ts` (EXCLUDING `*.test.ts` — a test-only edit
 *  needs no restart), plus the root `package.json` + `bun.lock` (a dep bump needs a restart and is
 *  otherwise invisible from `bridge/`). Re-`readdir`s each call so an added/deleted source counts. */
export function bridgeStampSync(bridgeDir: string, rootDir: string): string {
  const entries: { path: string; mtimeMs: number; size: number }[] = [];
  const add = (path: string) => {
    try {
      const s = statSync(path);
      entries.push({ path, mtimeMs: s.mtimeMs, size: s.size });
    } catch {
      /* a missing file is itself a change vs the startup stamp — just omit it */
    }
  };
  let names: string[] = [];
  try {
    names = readdirSync(bridgeDir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"));
  } catch {
    /* unreadable bridge dir → an empty stamp; startup captured the same, so not "stale" */
  }
  for (const n of names) add(join(bridgeDir, n));
  add(join(rootDir, "package.json"));
  add(join(rootDir, "bun.lock"));
  return stampOf(entries);
}

/** The GitHub release page for a version, e.g. `…/releases/tag/v0.32.0+collie.16`. Collie tags use a
 *  `v` prefix reconstructed from the bare version. GitHub
 *  serves the tag page even when there's no formal release attached, so this is always a live link. */
export function githubReleaseUrl(repo: string, version: string): string {
  return `https://github.com/${repo}/releases/tag/v${version}`;
}

/** Anonymous HTTPS fetch of a GitHub repo's tags → their names (`["v0.11.0", …]`). Throws on a
 *  non-OK response or timeout so the caller keeps its previous result and retries next tick. */
export function githubTagsFetcher(repo: string): () => Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;
  return async () => {
    const res = await fetch(url, {
      headers: { accept: "application/vnd.github+json", "user-agent": "collie-update-check" },
      signal: AbortSignal.timeout(TAGS_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`github tags: HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((t) => (typeof (t as { name?: unknown }).name === "string" ? (t as { name: string }).name : ""))
      .filter(Boolean);
  };
}

// ── Persistence (edge-trigger de-dupe across restarts) ────────────────────────

/** Records the last release we pushed a notification for, so the periodic re-check doesn't re-nag the
 *  same version. Its own tiny store (NOT piggybacked on push-subscriptions.json), owner-only. */
export class UpdateStateStore {
  private lastVersion: string | null = null;
  private readonly file: string;

  constructor(private readonly cfg: Config) {
    this.file = join(cfg.stateDir, "update-state.json");
  }

  async load(): Promise<void> {
    try {
      const raw = (await Bun.file(this.file).json()) as { lastNotified?: unknown };
      this.lastVersion = typeof raw.lastNotified === "string" ? raw.lastNotified : null;
    } catch {
      /* none saved yet */
    }
  }

  lastNotified(): string | null {
    return this.lastVersion;
  }

  async setLastNotified(version: string): Promise<void> {
    this.lastVersion = version;
    await mkdir(this.cfg.stateDir, { recursive: true, mode: 0o700 });
    // Atomic write (tmp + rename), matching Push/NotifyPrefs/Snooze — a crash mid-write can't leave a
    // corrupt file that would re-nag (or worse) on the next load.
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify({ lastNotified: version }, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}

// ── The monitor ───────────────────────────────────────────────────────────────

/** Persistence seam — just what the monitor needs from {@link UpdateStateStore}. */
export interface UpdateStore {
  lastNotified(): string | null;
  setLastNotified(version: string): Promise<void>;
}

export interface UpdateMonitorDeps {
  /** The `owner/name` repo the release check + release links point at (default `AltanS/collie`). */
  repo: string;
  /** The running plugin version (captured at process start — never re-read from disk, or a post-pull
   *  package.json would mask the very update we're detecting). */
  current: string;
  /** The bridge source stamp captured at process start (see {@link bridgeStampSync}). */
  startupStamp: string;
  /** Fetch the upstream release tag names (throws on failure — the monitor is fail-soft). */
  fetchTags: () => Promise<string[]>;
  /** Recompute the on-disk bridge source stamp for the staleness check. */
  bridgeStamp: () => string;
  store: UpdateStore;
  now: () => number;
  /** Whether update pushes are enabled (the `updates` notify pref — the user's off-switch). */
  updatesEnabled: () => boolean;
  /** Fire the update-available push for `latest`. */
  notify: (latest: string) => void;
}

export class UpdateMonitor {
  private latest: string | null = null;
  private majorAvailable: string | null = null;
  private checkedAt: number | null = null;
  private staleAt = Number.NEGATIVE_INFINITY;
  private staleValue = false;
  private inFlight: Promise<void> | null = null;

  constructor(private readonly deps: UpdateMonitorDeps) {}

  /**
   * Trigger a release-check cycle. De-dupes concurrent callers (the periodic timer and a manual
   * "check now" landing together await the SAME fetch, never two), so the on-demand endpoint can't
   * hammer the API. Always fail-soft — see {@link runCheck}.
   */
  checkRelease(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.runCheck().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * One release-check cycle: fetch tags, recompute `latest`, and fire an at-most-once push for a new
   * version. Fail-soft — a fetch error keeps the previous `latest`/`checkedAt`. The push is gated on
   * the `updates` pref and de-duped against `lastNotified`; the version is persisted BEFORE the send
   * so a crash mid-send leaves an under-delivered nag rather than a duplicate.
   */
  private async runCheck(): Promise<void> {
    let tags: string[];
    try {
      tags = await this.deps.fetchTags();
    } catch {
      return; // network / timeout — keep prior state, retry next tick
    }
    // Two answers, never one (ADR 0020): the newest release the operator can take on a routine
    // `update` — which stays inside the running major — and, separately, whether a MAJOR is out at
    // all. A version we can't parse a major out of (`unknown`) falls back to the old "newest of
    // anything", because an install that can't name its major can't be gated on it either.
    const major = majorOf(this.deps.current);
    this.latest = major === null ? latestReleaseTag(tags) : latestReleaseInMajor(tags, major);
    this.majorAvailable = major === null ? null : latestReleaseAboveMajor(tags, major);
    this.checkedAt = this.deps.now();

    const { current, store } = this.deps;
    if (
      this.latest &&
      this.deps.updatesEnabled() &&
      shouldNotify({ current, latest: this.latest, lastNotified: store.lastNotified() })
    ) {
      await store.setLastNotified(this.latest);
      this.deps.notify(this.latest);
    }
  }

  /** Recompute (throttled) whether the running process is behind the on-disk bridge source. */
  private bridgeStale(): boolean {
    const now = this.deps.now();
    if (now - this.staleAt < STALE_TTL_MS) return this.staleValue;
    this.staleValue = this.deps.bridgeStamp() !== this.deps.startupStamp;
    this.staleAt = now;
    return this.staleValue;
  }

  /** The snapshot-facing status. Cheap: `latest` is cached from the last check, `bridgeStale` throttled. */
  status(): UpdateStatus {
    const { current } = this.deps;
    return {
      current,
      latest: this.latest,
      latestUrl: this.latest ? githubReleaseUrl(this.deps.repo, this.latest) : null,
      releaseAvailable: this.latest !== null && releaseIsNewer(this.latest, current),
      majorAvailable: this.majorAvailable,
      majorUrl:
        this.majorAvailable === null
          ? null
          : githubReleaseUrl(this.deps.repo, this.majorAvailable),
      bridgeStale: this.bridgeStale(),
      checkedAt: this.checkedAt,
    };
  }
}
