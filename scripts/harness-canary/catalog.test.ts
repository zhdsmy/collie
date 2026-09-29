import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import { features, loadCatalog, replayCatalog } from "./catalog";

const ROOT = resolve(import.meta.dirname, "../..");

describe("adaptation catalog", () => {
  test("has unique, existing references and replays every captured screen through the real harness", async () => {
    const catalog = loadCatalog();
    expect(catalog.features).toEqual(features);
    expect(new Set(features.map((feature) => feature.id)).size).toBe(features.length);
    expect(features.every((feature) => feature.origin === "shared" ? feature.agent === "shared" : feature.agent !== "shared")).toBe(true);

    const live = features.filter((feature) => feature.live).map((feature) => feature.id).toSorted();
    expect(live).toEqual([
      "claude.agents",
      "claude.resume",
      "claude.settings.config",
      "claude.settings.stats",
      "claude.settings.status",
      "claude.settings.usage",
      "codex.agents",
      "codex.fork",
      "codex.model",
      "codex.resume",
      "codex.statusline-picker",
    ]);

    for (const feature of features) {
      for (const path of [...feature.sources, ...feature.tests, ...feature.fixtures.map((fixture) => fixture.path)]) {
        expect(existsSync(resolve(ROOT, path)), `${feature.id}: missing ${path}`).toBe(true);
      }
      for (const fixture of feature.fixtures) {
        expect(fixture.expect.block || fixture.expect.sessionInfo || fixture.expect.statusLinesMin || fixture.expect.scaleMin || fixture.expect.surface,
          `${feature.id}: ${fixture.path} has no replay assertion`).toBeTruthy();
      }
    }

    const results = await replayCatalog(catalog);
    const failures = results.filter((result) => result.status === "fail");
    expect(failures.map((failure) => `${failure.id}: ${failure.detail}`)).toEqual([]);
    expect(results).toHaveLength(features.length);
    expect(results.filter((result) => result.status === "unverified").map((result) => result.id)).toEqual([]);
  });
});
