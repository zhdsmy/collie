# Claude Queue / Steer

Settings → Device → Claude sending stores a per-device default, independently of Codex.
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
Claude's queue or apply the Codex setting to Claude.

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
and refusal to report success without evidence. Browser tests cover preference independence,
reload persistence, default/one-off sends, commands and the 320px layout.

Native semantics: [Claude interactive mode](https://code.claude.com/docs/en/interactive-mode#queue-messages-while-claude-works).

Validation: 614 protocol/shadow checks, a final 32-check capability/catalog batch, 267 profile checks, 297 composer/preferences checks, both typechecks and lint passed. Four 320px browser checks passed in Chromium/WebKit (Claude and Codex). Counts overlap and are not summed. The localhost simulated provider proves native keyboard behavior, not real-provider model response quality.
