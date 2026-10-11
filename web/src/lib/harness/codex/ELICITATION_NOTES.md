# Codex MCP tool approval forms

Codex 0.162.1 renders Computer Use application permissions in an MCP elicitation form:
`Field 1/1`, request text and optional parameter summaries, numbered options, then
`enter to submit | esc to cancel`. This is distinct from exec approvals and from
`request_user_input` questions, whose notes and submission rules do not apply.

The card reuses the single-choice picker. A row tap walks the native pointer with Up/Down,
re-reads the exact request/options after each step, then submits Enter. Browsing arrows only
move the pointer. Cancel sends Escape. Labels retain the native permission scope, including
session and future tool calls; no permission is granted merely by opening the card.

## Evidence — 2026-10-12

An isolated Herdr canary ran the installed Codex 0.162.1 against a local inert stdio MCP
server. The server sent `elicitation/create` during startup with an empty object schema,
`codex_approval_kind: mcp_tool_call`, `persist: [session, always]`, the screenshot's TextEdit
question and its `tool_params_display` App summary. The provider pointed to an unused local
port: no model request, Computer Use call or real application permission was involved.

- Up/Down moved the pointer without submitting. The header gained `(1 required unanswered)`
  and the request gained accent paint; these are pointer state, not a new request identity.
- Escape returned `{ action: cancel }` to the test server.
- At 100 columns, the real `submitPickerIntent` and bridge `keysPane` sent Down then Enter;
  the server returned `{ action: accept, content: {}, _meta: { persist: session } }`.
- At 50 columns, descriptions wrapped in their own column; the same guarded flow sent three
  Down keys then Enter and the server returned `{ action: cancel }`.
- The canary session was deleted. Only dialog rows enter the checked-in ANSI fixtures:
  `codex--v0162-tool-approval-{open,session,once,narrow}.txt`.

The installed version's public implementation confirms these transitions:
[`mcp_server_elicitation.rs`](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/tui/src/bottom_pane/mcp_server_elicitation.rs),
`from_parts`, `option_rows`, `footer_tips`, and `handle_key_event`.

## Boundaries

Only complete single-field tool approvals with the known Allow/optional session/optional
always/Cancel semantics are lifted. Request text and parameter summaries remain opaque.
Other MCP forms, multi-field forms, custom submit keys, truncated options and unknown permission
semantics keep the native fallback. No general form editor or new backend protocol is added.

Parser tests cover captured and background-free paint, pointer identity, wrapping, partial
screens and altered scopes. The action regression refuses a target app changed during a walk.
The 320px browser test saves light/dark screenshots, checks blocked composer submission with
the draft retained and no page overflow, and replays the captured guarded session-selection transition. These screenshots
prove rendering; the isolated native probe above supplies keyboard evidence. Real TextEdit
permission and installed iPhone PWA behavior were not exercised.
