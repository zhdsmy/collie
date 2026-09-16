import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JsonObject, JsonValue } from "../bridge/json";

const ROOT = join(import.meta.dir, "..");
const SCRIPT = join(import.meta.dir, "claude-statusline.sh");
let workspace = "";

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), "collie-claude-statusline-"));
  const init = Bun.spawnSync(["git", "init", "--quiet", "--initial-branch=statusline-test", workspace]);
  if (init.exitCode !== 0) throw new Error(init.stderr.toString());
});

afterAll(() => {
  if (workspace !== "") rmSync(workspace, { recursive: true, force: true });
});

function payload(overrides: JsonObject = {}) {
  return {
    model: { display_name: "Claude Sonnet" },
    effort: { level: "high" },
    context_window: { remaining_percentage: 73.9 },
    workspace: { current_dir: workspace },
    version: "2.1.273",
    ...overrides,
  };
}

function run(value: JsonValue): string {
  const proc = Bun.spawnSync(["bash", SCRIPT], {
    cwd: ROOT,
    stdin: Buffer.from(JSON.stringify(value)),
  });
  expect(proc.exitCode).toBe(0);
  expect(proc.stderr.toString()).toBe("");
  return proc.stdout.toString().trimEnd();
}

function runRaw(value: string): string {
  const proc = Bun.spawnSync(["bash", SCRIPT], {
    cwd: ROOT,
    stdin: Buffer.from(value),
  });
  expect(proc.exitCode).toBe(0);
  expect(proc.stderr.toString()).toBe("");
  return proc.stdout.toString().trimEnd();
}

describe("claude-statusline", () => {
  test.each([
    [false, true, "Fast:off"],
    [true, false, "Fast:on"],
  ])("uses fast_mode=%s independently of thinking.enabled", (fastMode, thinkingEnabled, expected) => {
    expect(run(payload({ fast_mode: fastMode, thinking: { enabled: thinkingEnabled } }))).toBe(
      `Claude Sonnet high | ${expected} | ctx 73% | statusline-test | v2.1.273`,
    );
  });

  test("hides missing optional fields and keeps model effort optional", () => {
    expect(run(payload({ model: { display_name: "Claude" }, effort: undefined }))).toBe(
      "Claude | ctx 73% | statusline-test | v2.1.273",
    );
    expect(run(payload({ model: { display_name: "Claude" }, effort: { level: null }, fast_mode: null }))).toBe(
      "Claude | ctx 73% | statusline-test | v2.1.273",
    );
  });

  test.each([0, 100, 73.9])("floors valid remaining context percentage %s", (value) => {
    expect(run(payload({ context_window: { remaining_percentage: value } }))).toContain(`ctx ${Math.floor(value)}%`);
  });

  test.each([
    null,
    -1,
    101,
    "73",
    {},
  ])("hides malformed remaining context percentage %j", (value) => {
    expect(run(payload({ context_window: { remaining_percentage: value } }))).not.toContain("ctx ");
  });

  test.each([
    [{ warm: true, hit_ratio: 0.756 }, "cache warm 76%"],
    [{ warm: false, hit_ratio: 0 }, "cache cold 0%"],
    [{ warm: true, hit_ratio: null }, "cache warm"],
    [{ warm: false }, "cache cold"],
    [{ warm: false, hit_ratio: 1.5 }, "cache cold"],
    [{ warm: true, hit_ratio: "0.5" }, "cache warm"],
    [{ warm: false, caching_observed: false, hit_ratio: 0 }, "cache unreported"],
  ])("formats prompt cache %j", (cache, expected) => {
    expect(run(payload({ prompt_cache: cache }))).toContain(expected);
  });

  test("hides absent prompt cache instead of inventing cold or zero percent", () => {
    const output = run(payload());
    expect(output).not.toContain("cache");
    expect(output).not.toContain("0%");
  });

  test("fails closed for malformed JSON", () => {
    expect(runRaw("{not valid json")).toBe("");
  });
});
