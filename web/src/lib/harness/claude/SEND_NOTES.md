# Claude Queue / Steer

Settings → Device → Sending stores one per-device default shared by Codex and Claude Code.
The former explicit Codex choice takes precedence during migration, otherwise the former Claude
choice is retained. A new shared choice takes precedence over both old fields.
Queue is the initial default. Only ordinary messages during a readable running turn use it;
commands, dialogs, and terminal Input mode retain their existing behavior. Queue also offers
a one-off Steer now button beside Send when the phone draft holds an ordinary message.

Enter queues on current Claude Code. Steer uses the same `mode: send, when: steer` protocol
as other harnesses, with Claude's native `Ctrl+X Ctrl+S` chord, rather than Escape or a second
message. The shared probe, exact-draft check, pane/session lock, capability gate and post-submit
transcript witness remain in charge. An unsupported chord that leaves the draft does not report
success. Native versions before 2.1.275, unread versions and revoked profiles cannot steer.

Claude's Send now submits **all queued messages and the current draft**. It can background
ongoing tools or interrupt a response that cannot continue in the background; it does not mean
the same tool-boundary timing as Codex. Settings states this behavior. Collie does not rewrite
Claude's queue. Other agents do not use this default setting; their existing native or one-off
steering behavior is retained.

## Local native verification — 2026-10-25

Claude Code **2.1.310** ran in an owned, isolated PTY and temporary config/cwd using `--bare`,
no tools, no hooks and a loopback Anthropic-compatible test server. The dummy API key was
accepted only in that temporary config; no actual provider, credentials or user conversation
was used. The streaming test server kept the native turn busy.

Enter displayed the native queue hint. Before steering, no API request contained
`QUEUED_NATIVE_PROOF`. With `STEER_DRAFT_PROOF` in the composer, the bytes for Ctrl+X then
Ctrl+S produced a subsequent request containing both markers. The process exited and the
test server closed after capture. Sanitized result:

```json
{"version":"2.1.310","queueWaited":true,"steerSentDraftAndQueue":true,"requests":3}
```

Raw terminal recordings and the result are saved in
`/private/tmp/collie-claude-steer-zfwgvw_z/`. These differential terminal updates are not a
standalone screen fixture and do not certify all Claude screens. The catalog separately replays
the existing 2.1.301 queued-message fixture; protocol tests prove key choice, version refusal,
and refusal to report success without evidence. Browser tests cover the single shared control,
reload persistence, default/one-off sends, commands and the 320px layout.

Native semantics: [Claude interactive mode](https://code.claude.com/docs/en/interactive-mode#queue-messages-while-claude-works).

Before the shared-control merge (v1.24.0+collie.2): 614 protocol/shadow checks, a final 32-check capability/catalog batch, 267 profile checks, 297 composer/preferences checks, both typechecks and lint passed. Four 320px browser checks passed in Chromium/WebKit (Claude and Codex). Counts overlap and are not summed. The localhost simulated provider proves native keyboard behavior, not real-provider model response quality.

## Scope of the shared default

- Codex and Claude Code read this shared default. Existing settings migrate once, with an
  explicit Codex value preferred when the old choices disagree.
- pi and OMP already declare steer keys and post-submit witnesses in their profiles, with
  upstream native captures and protocol regressions. They keep their one-off Steer UI and do
  not read this default. They are not classified as unsupported or wholly untested.
- AGY's profile delegates its running-turn choice to its native settings. Other profiles without
  a declared steering key/witness do not advertise this Send Protocol capability. This does not
  prove their native clients cannot queue or steer; the shared switch is not integrated or
  certified for them.

Shared-control validation: 304 preference/composer checks (including six migration cases and
pi/OMP retaining their own default), the 68-feature catalog, both typechecks and lint passed.
Only the settings and preference read path changed; no new native-model probe was needed.
Four 320px Chromium/WebKit scenarios passed after the test waited for each send to clear the phone draft before typing the next message. Screenshots are saved under `/private/tmp/collie-send-setting-e2e/` and `/private/tmp/collie-send-setting-e2e-final/`.
