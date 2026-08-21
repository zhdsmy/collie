# 0021: Downstream revisions preserve the upstream base

**Status:** Accepted

## Context

This fork continues to release local fixes while its imported upstream release remains `0.32.0`.
Numbering those releases `0.32.1`, `0.32.2`, and so on hides that base and can be confused with
upstream patch releases that have not been imported. A four-part number such as `0.32.0.16` would
show the relationship, but is not valid Semantic Versioning and is rejected by package tooling.

SemVer build metadata can carry the relationship as `0.32.0+collie.16`, but generic SemVer
comparison intentionally ignores build metadata. Collie's update monitor and managed-checkout
updater therefore need one shared, explicit ordering rule. Existing `v0.32.x` Releases must remain
available during the migration rather than being deleted or retagged.

## Decision

Use `UPSTREAM+collie.REVISION` for downstream releases. `UPSTREAM` is the exact imported upstream
release and `REVISION` is a positive integer incremented for each local release on that base. When a
new upstream release is imported, replace `UPSTREAM` and restart `REVISION` at `1`.

Tag the same value with a leading `v`, for example `v0.32.0+collie.16`. Collie's own comparators
treat `collie.REVISION` numerically after the upstream triple. On an `X.Y` release line containing a
downstream tag, downstream tags supersede legacy flat `vX.Y.Z` tags on that same line; other release
lines remain eligible. This preserves old Releases without allowing a managed install to roll back.

ADR 0020's major-upgrade consent still applies to the upstream major component.

## Consequences

- Package and plugin versions remain valid SemVer and visibly name their upstream base.
- Generic SemVer tools consider two `+collie.N` revisions equal, so release selection must use the
  project comparators covered by bridge and lifecycle tests.
- Release-note extraction must match version headings literally because `+` is a regex operator.
- Old flat tags remain valid history but stop winning selection once the downstream scheme appears
  on their `X.Y` line.
