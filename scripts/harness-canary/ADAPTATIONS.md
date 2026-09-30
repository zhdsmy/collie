# Maintaining adaptations

```sh
bun scripts/harness-watch.ts --replay
bun scripts/harness-watch.ts --once
bun scripts/harness-watch.ts --force
bun scripts/harness-watch.ts --force --dialogs --screenshots
bun scripts/harness-watch.ts --force --agent codex --screenshots
```

[`adaptations.json`](./adaptations.json) is the inventory: stable feature ID, owning agent,
upstream/downstream origin, source files, tests, captured fixtures, live recipe and last capture
evidence. It includes individual agent adaptations and shared card primitives. Fixture replay
runs the actual ANSI parser and public block pipeline, including history folding and statuslines.

## Economical Verification

Choose checks for the change being delivered; the commands above are alternatives, not a checklist.

- **Routine repairs:** replay affected fixtures and run focused parser/action checks. Changes to
  focus ownership, keys or sending need a relevant isolated live interaction. Preserve the real
  ANSI and key failure/fix screenshots.
- **CLI updates:** target the updated CLI with `--agent`; prioritize model selection, Resume,
  Agents and composer hiding. Include other CLIs when a shared behavior changed.
- **Model-backed dialogs:** add approval/question probes when repairing those interactions or
  resolving a concrete remaining risk. An unreachable screen stays pending with its reason and
  available capture; do not repeat probes solely to reduce that count. Diagnose observed failures.
- **Screenshots:** render existing captures without another model request. Save key evidence;
  screenshot replay alone does not prove live keyboard or browser button behavior.
- **Scope and gates:** broaden or repeat checks only for a concrete unresolved risk or a required
  release gate. `pending`, `fixture-only` and `not-installed` describe coverage boundaries, not
  counts to clear or automatic release blockers. Required release checks still apply.
- **Monitoring:** keep the hourly schedule disabled by default; enable it only when the operator
  requests ongoing monitoring.

## After A CLI Update

The watcher compares installed CLI versions and a content hash of relevant adaptation/checker
sources with its previous run. Changed Codex and Claude installations run the existing isolated
card canary. Each makes at most one small model turn; unchanged polling makes none. Documentation,
release version bumps and ordinary Git commits do not trigger another run.

`--dialogs` adds a focused Codex command approval, Claude AskUserQuestion, and OpenCode
permission probe. These make extra model requests; they do not run busy or plan scenarios.
`--agent codex,claude` limits live runs while keeping the other features in the report.
The normal watcher still runs only Codex/Claude cards. Running a check does not install a schedule.

`--screenshots` renders saved ANSI frames through the selected checkout's real Collie UI at
320x844. PNGs and Markdown/JSON indexes live beside each run in `screenshots/`, link to the original
ANSI and case result, and include failed or unreached frames when captured. The replay uses stubbed
APIs and blocks outbound browser requests. Images show rendering; live cases supply keyboard and
current-CLI evidence. Screenshots do not certify browser button actions. Existing captures can be
rendered without another model request:

```sh
bun scripts/harness-canary/screenshots.ts /path/to/run
```

Optional hourly monitoring, only when requested by the operator. Install from the stable checkout:

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
screen safely. Use its feature ID as the case prefix, or set `liveCase` explicitly. Modal recipes
require `open` and `escape`; `liveChecks` names other required outcomes, such as statusline
`observe`, approval `open`/`decline`, or question `open`/`answer`. Every matching case must pass.
A single-question probe does not certify every wizard, multiselect, or preview variant listed
under that feature.

Keep recognition conservative: native heading, region boundary, row structure and advertised
keys provide independent checks. Unknown screens stay native. A repair leaves a focused parser
or action regression; browser checks cover layout/guarded taps. Passive detection of suspected
failures in daily sessions is deferred until these checks leave a concrete gap.
