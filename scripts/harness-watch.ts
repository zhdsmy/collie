#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { HOST } from "../bridge/host.ts";
import { loadContext } from "../cli/context";
import { installedVersion } from "./harness-drift";
import { loadCatalog, replayCatalog, type AdaptationFeature, type FeatureReplayResult } from "./harness-canary/catalog";
import type { CaseResult, ScenarioResult } from "./harness-canary/verdict";

const ROOT = resolve(import.meta.dirname, "..");
const LABEL = "dev.collie.harness-watch";
const LIVE_AGENTS = ["codex", "claude", "opencode"] as const;

interface LiveRun {
  version: string;
  fingerprint: string;
  checked: string;
  evidence: string;
  cases: CaseResult[];
  screenshots?: string;
  dialogs?: boolean;
  error?: string;
}

export interface FeatureHealth {
  id: string;
  agent: string;
  version: string | null;
  replay: FeatureReplayResult["status"];
  live: "pass" | "fail" | "pending" | "not-installed";
  status: "pass" | "fail" | "pending" | "fixture-only" | "not-installed";
  detail: string;
  evidence: string | null;
}

interface HealthReport {
  checked: string;
  runs: Record<string, LiveRun>;
  features: FeatureHealth[];
}

export function featureHealth(feature: AdaptationFeature, replay: FeatureReplayResult, version: string | null, run?: LiveRun): FeatureHealth {
  const id = feature.liveCase ?? feature.id;
  const cases = run?.version === version ? run.cases.filter((c) => c.id.startsWith(`${id}.`)) : [];
  const complete = (feature.liveChecks ?? ["open", "escape"]).every((step) =>
    cases.some((c) => c.id === `${id}.${step}` && c.verdict === "pass"));
  const live = version === null ? "not-installed" : cases.some((c) => c.verdict === "fail") ? "fail"
    : complete && cases.every((c) => c.verdict === "pass") ? "pass" : "pending";
  const status = replay.status === "fail" || live === "fail" ? "fail" : live === "pass" ? "pass"
    : feature.agent === "shared" ? (replay.status === "pass" ? "fixture-only" : "pending") : live;
  return {
    id: feature.id, agent: feature.agent, version, replay: replay.status, live, status,
    detail: replay.status === "fail" ? replay.detail : cases.find((c) => c.verdict !== "pass")?.detail
      ?? (live === "pass" ? "registered current TUI checks passed; browser confirmation remains separate"
        : run?.error ?? "no current-version live evidence; fixture replay does not certify a CLI update"),
    evidence: run?.version === version && cases.length ? run.evidence : null,
  };
}

export function healthSignature(features: readonly FeatureHealth[]): string {
  return JSON.stringify(features.map((f) => [f.id, f.version, f.status, f.replay]));
}

function fingerprint(features: readonly AdaptationFeature[]): string {
  const files = new Set(features.flatMap((f) => f.sources));
  files.add("scripts/harness-watch.ts");
  const scan = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) scan(path);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.add(path);
    }
  };
  scan("scripts/harness-canary");
  scan("web/src/lib/harness");
  const hash = createHash("sha256").update(JSON.stringify(features.map((f) => [f.id, f.live, f.liveCase, f.liveChecks, f.sources])));
  for (const file of [...files].toSorted()) hash.update(file).update(readFileSync(join(ROOT, file)));
  return hash.digest("hex");
}

async function liveRun(agent: string, version: string, stamp: string, dir: string, dialogs: boolean, screenshots: boolean): Promise<LiveRun> {
  const out = join(dir, "captures", `${Date.now()}-${agent}`);
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const log = join(out, "run.log");
  const scenarios = agent === "opencode" ? "dialogs" : dialogs ? "cards,dialogs" : "cards";
  const child = Bun.spawn([process.execPath, join(ROOT, "scripts/harness-canary/run.ts"), "--agent", agent, "--scenario", scenarios, "--out", out, ...(dialogs ? ["--card-dialogs"] : []), ...(screenshots ? ["--screenshots"] : [])], {
    cwd: ROOT, stdout: Bun.file(log), stderr: Bun.file(log),
  });
  let timedOut = false;
  let hardStop: ReturnType<typeof setTimeout> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    hardStop = setTimeout(() => child.kill("SIGKILL"), 30_000);
  }, 8 * 60_000);
  try {
    await child.exited;
  } finally {
    clearTimeout(timer);
    clearTimeout(hardStop);
  }
  const summary = readdirSync(out).map((p) => join(out, p, "summary.json")).find(existsSync);
  const run: LiveRun = { version, fingerprint: stamp, checked: new Date().toISOString(), evidence: summary ?? log, cases: [], dialogs };
  if (summary && !timedOut) {
    // SAFETY: the owned canary writes this summary contract, including per-case verdicts.
    const parsed = JSON.parse(readFileSync(summary, "utf8")) as { versions: Record<string, string>; results: ScenarioResult[] };
    if (parsed.versions[agent] !== version) run.error = "CLI version changed during the check; run --force again";
    else run.cases = parsed.results.filter((r) => r.agent === agent).flatMap((r) => r.cases);
    const index = join(summary, "..", "screenshots", "index.md");
    if (existsSync(index)) run.screenshots = index;
  } else run.error = timedOut ? `check timed out; inspect cleanup and ${log}` : `check did not produce a summary; inspect ${log}`;
  return run;
}

function markdown(report: HealthReport): string {
  return ["# Collie adaptation health", "", `Checked: ${report.checked}`, "",
    "Fixture replay and current TUI checks are separate. Pass applies to the listed card, not the entire agent.", "",
    ...Object.entries(report.runs).filter(([, run]) => run.screenshots).map(([agent, run]) => `[${agent} replay screenshots](${run.screenshots})`), "",
    "| Feature | CLI version | Fixture | Current status | Evidence |", "| --- | --- | --- | --- | --- |",
    ...report.features.map((f) => `| ${f.id} | ${f.version ?? "unavailable"} | ${f.replay} | ${f.status} | ${f.evidence ?? "pending live check"} |`),
    "", ...report.features.filter((f) => f.status === "fail" || f.status === "pending").map((f) => `- ${f.id}: ${f.detail}`), ""].join("\n");
}

function save(report: HealthReport, dir: string): void {
  const target = join(dir, "latest.json");
  writeFileSync(`${target}.tmp`, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  renameSync(`${target}.tmp`, target);
  writeFileSync(join(dir, "latest.md"), markdown(report), { mode: 0o600 });
  // Keep two owned capture runs per agent; the cache always references the newest one.
  const captures = join(dir, "captures");
  if (existsSync(captures)) for (const agent of LIVE_AGENTS) {
    const names = readdirSync(captures).filter((p) => new RegExp(`^\\d+-${agent}$`).test(p)).toSorted().toReversed();
    for (const old of names.slice(2)) rmSync(join(captures, old), { recursive: true });
  }
}

function counts(features: readonly FeatureHealth[]): string {
  return ["pass", "fail", "pending", "fixture-only", "not-installed"].map((s) => `${features.filter((f) => f.status === s).length} ${s}`).join(", ");
}

function notify(report: HealthReport): void {
  if (HOST.platform !== "darwin") return;
  const result = Bun.spawnSync(["osascript", "-e", "on run argv", "-e", 'display notification (item 1 of argv) with title "Collie card checks"', "-e", "end run", counts(report.features)], { timeout: 5_000 });
  if (result.exitCode) console.error("harness-watch: notification failed; latest.md still contains the findings");
}

function install(dir: string): void {
  if (HOST.platform !== "darwin") throw new Error("--install uses macOS LaunchAgents");
  const launchDir = join(homedir(), "Library/LaunchAgents");
  mkdirSync(launchDir, { recursive: true });
  const plist = join(launchDir, `${LABEL}.plist`);
  if (existsSync(plist)) throw new Error(`schedule already exists: ${plist}; inspect it before replacing`);
  const temp = join(dir, "launch-agent.json");
  writeFileSync(temp, JSON.stringify({
    Label: LABEL, ProgramArguments: [process.execPath, join(ROOT, "scripts/harness-watch.ts"), "--state-dir", dir],
    WorkingDirectory: ROOT, StartInterval: 3600, RunAtLoad: true,
    EnvironmentVariables: { PATH: process.env.PATH ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" },
    StandardOutPath: join(dir, "watch.log"), StandardErrorPath: join(dir, "watch.log"),
  }), { mode: 0o600 });
  try {
    const converted = Bun.spawnSync(["plutil", "-convert", "xml1", "-o", plist, temp]);
    if (converted.exitCode) throw new Error(converted.stderr.toString());
    const activated = Bun.spawnSync(["launchctl", "bootstrap", `gui/${process.getuid?.()}`, plist]);
    if (activated.exitCode) throw new Error(activated.stderr.toString());
  } finally { rmSync(temp, { force: true }); }
  console.log(`hourly schedule: ${plist}`);
}

async function main(argv: string[]): Promise<number> {
  const allowed = new Set(["--once", "--force", "--replay", "--install", "--no-notify", "--state-dir", "--dialogs", "--screenshots", "--agent"]);
  let dir = "";
  let agents: string[] = [...LIVE_AGENTS];
  for (let i = 0; i < argv.length; i++) {
    if (!allowed.has(argv[i]!)) throw new Error(`unknown option: ${argv[i]}`);
    if (argv[i] === "--state-dir") {
      if (!argv[i + 1] || argv[i + 1]!.startsWith("--")) throw new Error("--state-dir needs a directory");
      dir = resolve(argv[++i]!);
    } else if (argv[i] === "--agent") {
      if (!argv[i + 1] || argv[i + 1]!.startsWith("--")) throw new Error("--agent needs comma-separated agents");
      agents = argv[++i]!.split(",");
      if (agents.some((agent) => !LIVE_AGENTS.some((name) => name === agent))) throw new Error("--agent supports codex,claude,opencode");
    }
  }
  const catalog = loadCatalog();
  const replay = await replayCatalog(catalog);
  if (argv.includes("--replay")) {
    for (const r of replay) console.log(`${r.id}: ${r.status} (${r.detail})`);
    return replay.some((r) => r.status === "fail") ? 1 : 0;
  }
  if (!dir) dir = join(loadContext().stateDir, "harness-health");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (argv.includes("--install")) { install(dir); return 0; }
  const latest = join(dir, "latest.json");
  // SAFETY: latest.json is the private cache written by save() with this report contract.
  const previous = existsSync(latest) ? JSON.parse(readFileSync(latest, "utf8")) as HealthReport : undefined;
  const runs = previous?.runs ?? {};
  const versions = new Map([...new Set(catalog.features.map((f) => f.agent))].map((a) => [a, a === "shared" ? null : installedVersion(a)]));
  for (const agent of LIVE_AGENTS) {
    if (!agents.includes(agent)) continue;
    if (agent === "opencode" && !argv.includes("--dialogs")) continue;
    const version = versions.get(agent);
    if (!version) continue;
    const owned = catalog.features.filter((f) => f.agent === agent || f.agent === "shared");
    const stamp = fingerprint(owned);
    if (argv.includes("--force") || runs[agent]?.version !== version || runs[agent]?.fingerprint !== stamp ||
        (argv.includes("--dialogs") && !runs[agent]?.dialogs)) {
      console.log(`checking ${agent} ${version}`);
      runs[agent] = await liveRun(agent, version, stamp, dir, argv.includes("--dialogs"), argv.includes("--screenshots"));
    }
    if (argv.includes("--screenshots") && !runs[agent]?.screenshots && runs[agent]?.evidence.endsWith("summary.json")) {
      const { captureScreenshots } = await import("./harness-canary/screenshots");
      const images = await captureScreenshots(ROOT, resolve(runs[agent]!.evidence, ".."));
      runs[agent]!.screenshots = images.index;
      for (const error of images.errors) console.error(`screenshot error: ${error}`);
    }
  }
  const report: HealthReport = { checked: new Date().toISOString(), runs,
    features: catalog.features.map((f, i) => featureHealth(f, replay[i]!, versions.get(f.agent) ?? null, runs[f.agent])) };
  save(report, dir);
  console.log(`${counts(report.features)}; ${join(dir, "latest.md")}`);
  if (!argv.includes("--no-notify") && healthSignature(previous?.features ?? []) !== healthSignature(report.features)) notify(report);
  return report.features.some((f) => f.status === "fail") ? 1 : 0;
}

if (import.meta.main) {
  try { process.exit(await main(process.argv.slice(2))); }
  catch (error) { console.error(`harness-watch: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
}
