# Maintaining adaptations

```sh
bun scripts/harness-watch.ts --replay
bun scripts/harness-watch.ts --once
bun scripts/harness-watch.ts --force
```

[`adaptations.json`](./adaptations.json) is the inventory: stable feature ID, owning agent,
upstream/downstream origin, source files, tests, captured fixtures, live recipe and last capture
evidence. It includes individual agent adaptations and shared card primitives. Fixture replay
runs the actual ANSI parser and public block pipeline, including history folding and statuslines.

## After A CLI Update

The watcher compares installed CLI versions and a content hash of relevant adaptation/checker
sources with its previous run. Changed Codex and Claude installations run the existing isolated
card canary. Each makes at most one small model turn; unchanged polling makes none. Documentation,
release version bumps and ordinary Git commits do not trigger another run.

Install the hourly macOS schedule from the stable installed checkout:

```sh
cd ~/.local/share/collie
bun scripts/harness-watch.ts --install
launchctl print gui/$(id -u)/dev.collie.harness-watch
```

Reports default to the configured Collie state directory's `harness-health/latest.json` and
`latest.md`. `--state-dir DIR` overrides the health directory. Captures are private, with only
two owned runs retained per agent. Notifications fire when a version, failure, pending status
or recovery changes, and include no transcript. `--no-notify` suppresses local notifications.

The schedule runs hourly and at login; it does not require Collie's server to be restarted.
Unload it with `launchctl bootout gui/$(id -u)/dev.collie.harness-watch`. The canary has its own
session, refuses an existing `collie-canary`, and never sends keys to daily sessions. Each run
has an eight-minute timeout and requests cleanup before a bounded forced stop.

## Reading The Report

| Status | Meaning |
| --- | --- |
| `pass` | This card opened and cancelled on the installed CLI; confirmation remains a separate UI test. |
| `fail` | Captured replay regressed, or an observed current screen produced the wrong card. |
| `pending` | Current native screen was not reached, no live recipe exists, or the check could not complete. |
| `fixture-only` | Shared UI/parser behavior replayed; it is not an agent-version certification. |
| `not-installed` | CLI could not be version-probed on this host. |

Historical fixture success never certifies a newer CLI. Hermes and other agents without a live
recipe remain pending when installed; their last captured evidence stays in the inventory.
Agents lists can remain pending in an isolated session with no background task. A card-only
check cannot update the agent-wide `verified-versions.json` ledger.

## Adding Or Repairing A Card

Update its inventory entry in the same change: source, relevant test, sanitized real capture
and an observable assertion. Record the capture's version/date/provenance; label synthetic
screens as synthetic. Add a live recipe to `cards.ts` when it can open and cancel an owned
screen safely. Use its feature ID as the case prefix, or set `liveCase` explicitly.

Keep recognition conservative: native heading, region boundary, row structure and advertised
keys provide independent checks. Unknown screens stay native. A repair leaves a focused parser
or action regression; browser checks cover layout/guarded taps. Passive detection of suspected
failures in daily sessions is deferred until these checks leave a concrete gap.
