# AGENTS.md

Before changing anything, explicitly read [`CLAUDE.md`](./CLAUDE.md) and, when present,
the ignored [`CLAUDE.local.md`](./CLAUDE.local.md). They contain the shared working agreement and
this host's deployment procedure. A bare `@CLAUDE.md` is a reference, not an inline include in AGY.
Do not inline the full manuals here: both exceed AGY's 24,000-byte per-rule limit.

## Critical local deployment gate — all agents, including AGY

These safety constraints are repeated here so automatic rule loading cannot omit them:

- **Never install a fresh Bun build with its ad-hoc signature.** Before replacing the installed
  macOS binary, sign the staged binary with the existing `Collie Local Signing` identity and
  identifier `dev.collie.bridge`, using the established keychain in `CLAUDE.local.md`.
  Its designated requirement must match:

  ```text
  identifier "dev.collie.bridge" and certificate leaf = H"73f7427f76157dbdebdf6bc14f1fc7a56af4a898"
  ```

- **Verify before replacement and again before restart.** `codesign --verify --strict` must pass,
  and `codesign -d -r-` must show the requirement above. An ad-hoc `cdhash` requirement is a
  failure. If signing or verification fails, stop before installing; do not bypass the check,
  use another identity, recreate the certificate, or reset TCC. A previously mis-signed install
  does not authorize another one. The same gate applies to rollback activation.
- **Restart only Collie.** Preserve Herdr, Headroom and user agent sessions. After restart, verify
  the expected build, authenticated APIs and actual Documents file reading on localhost;
  a successful build or a restart action reporting `running` is insufficient.

For backup creation, location, retention, and cleanup, see
[Deployment Backups](./CLAUDE.md#deployment-backups).

@CLAUDE.md
