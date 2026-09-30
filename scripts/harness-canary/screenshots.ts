#!/usr/bin/env bun
import { createRequire } from "node:module";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import type { AddressInfo } from "node:net";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Browser, BrowserContext, Page, Route } from "../../web/node_modules/playwright-core";
import type { ScenarioResult } from "./verdict";

const AGENTS = ["claude", "codex", "opencode", "pi"] as const;
const VIEWPORT = { width: 320, height: 844 };
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface ViteServer {
  httpServer: { address(): AddressInfo | null } | null;
  listen(): Promise<void>;
  close(): Promise<void>;
  ssrLoadModule<T>(path: string): Promise<T>;
}

interface ViteRuntime {
  createServer(config: {
    configFile: string;
    root: string;
    logLevel: "error";
    server: { host: string; port: number; strictPort: boolean; open: boolean };
    resolve: { alias: { "@": string } };
  }): Promise<ViteServer>;
}

interface PlaywrightRuntime {
  chromium: { launch(options: { headless: boolean }): Promise<Browser> };
}

interface FixtureSnapshot {
  readonly agents: readonly { readonly paneId: string }[];
}

interface CanarySummary {
  readonly results: readonly ScenarioResult[];
}

interface ScreenshotEntry {
  agent: string;
  version: string;
  name: string;
  raw: string;
  image: string | null;
  verdict: string;
  result: string;
  warnings: string[];
  error?: string;
}

async function freeLoopbackPort(): Promise<number> {
  const server = createTcpServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  // SAFETY: this server bound a TCP address on 127.0.0.1, never a Unix socket.
  const address = server.address() as AddressInfo | null;
  if (address === null) throw new Error("Could not reserve a loopback TCP port");
  const port = address.port;
  await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
  return port;
}

export interface ScreenshotEvidenceSummary {
  readonly captured: number;
  readonly errors: readonly string[];
  readonly index: string;
}

function isCapture(name: string): boolean {
  return /^(?:(?:cards|dialogs|start|exit)-.+|idle(?:-50)?)\.ansi$/.test(name);
}

function resultFor(name: string, agent: string, summary: CanarySummary | null) {
  if (summary === null) return { verdict: "capture only", result: "No summary.json case record." };
  const base = name.replace(/\.ansi$/, "");
  const suffix = base.startsWith("dialogs-") ? base.slice("dialogs-".length) : null;
  const cardBase = base.startsWith("cards-") ? base.slice("cards-".length) : null;
  const cardCase = cardBase === null ? null : cardBase.endsWith("-escape-failed")
    ? `${cardBase.slice(0, -"-escape-failed".length)}.escape`
    : cardBase.includes("-")
      ? `${cardBase.slice(0, cardBase.lastIndexOf("-"))}.${cardBase.slice(cardBase.lastIndexOf("-") + 1)}`
      : null;
  for (const scenario of summary.results.filter((item) => item.agent === agent)) {
    for (const row of scenario.cases) {
      const matchedByFile = row.detail.includes(name);
      const matchedById = row.id === base || (suffix !== null && row.id === suffix) || (cardCase !== null && row.id === cardCase);
      if (!matchedByFile && !matchedById) continue;
      return {
        verdict: row.verdict,
        result: row.detail || `Case ${row.id}`,
      };
    }
  }
  const relatedScenario = base.startsWith("start-cards-")
    ? "cards"
    : base.startsWith("start-dialogs-")
      ? "dialogs"
      : base.startsWith("start-narrow-")
        ? "narrow"
        : base.startsWith("start-")
          ? "idle"
          : base.startsWith("exit-")
            ? "start-exit"
            : base === "idle-50"
              ? "narrow"
              : base === "idle"
                ? "idle"
                : null;
  const related = relatedScenario === null ? undefined : summary.results.find((item) => item.agent === agent && item.scenario === relatedScenario);
  if (related !== undefined) return { verdict: related.verdict, result: `${related.scenario}: ${related.detail}` };
  return { verdict: "capture only", result: "No matching summary.json case record." };
}

async function discover(runDir: string): Promise<{ agent: string; version: string; name: string; path: string }[]> {
  const captures: { agent: string; version: string; name: string; path: string }[] = [];
  for (const folder of await readdir(runDir, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const agent = AGENTS.find((candidate) => folder.name.startsWith(`${candidate}-`));
    if (agent === undefined) continue;
    const version = folder.name.slice(agent.length + 1);
    for (const file of await readdir(join(runDir, folder.name), { withFileTypes: true })) {
      if (!file.isFile() || !isCapture(file.name)) continue;
      captures.push({ agent, version, name: file.name, path: join(runDir, folder.name, file.name) });
    }
  }
  return captures.toSorted((a, b) => a.agent.localeCompare(b.agent) || a.name.localeCompare(b.name));
}

async function writeIndex(outputDir: string, runDir: string, entries: readonly ScreenshotEntry[], errors: readonly string[]): Promise<void> {
  const json = {
    run: basename(runDir),
    generatedAt: new Date().toISOString(),
    mode: "saved-terminal-replay",
    liveBehaviorVerified: false,
    viewport: VIEWPORT,
    network: "Only the loopback Vite app is allowed; API requests use browser fixtures.",
    entries,
    errors,
  };
  const rows = entries.map((entry) => {
    const title = `${entry.agent} ${entry.version} / ${entry.name.replace(/\.ansi$/, "")}`;
    const image = entry.image === null ? "Screenshot unavailable." : `![${title}](${entry.image})`;
    const warning = entry.warnings.length ? `\n- Warnings: ${entry.warnings.map((item) => `\`${item}\``).join("; ")}` : "";
    const error = entry.error === undefined ? "" : `\n- Screenshot error: \`${entry.error}\``;
    return `### ${title}\n\n${image}\n\n- Result: \`${entry.verdict}\` - ${entry.result}\n- Raw ANSI: [${entry.name}](${entry.raw})${warning}${error}`;
  });
  const failures = errors.length ? `\n\n## Errors\n\n${errors.map((error) => `- ${error}`).join("\n")}` : "";
  const markdown = [
    `# Canary screenshots: ${basename(runDir)}`,
    "",
    `Rendered at ${VIEWPORT.width}x${VIEWPORT.height} from the saved ANSI captures using the Collie source in the selected readers checkout.`,
    "",
    "> Replay evidence only: the PNG shows how Collie renders this saved frame. It does not prove the CLI still produces the frame or that live keyboard behavior works.",
    "",
    ...rows,
    failures,
    "",
  ].join("\n");
  await Promise.all([
    writeFile(join(outputDir, "index.json"), `${JSON.stringify(json, null, 2)}\n`),
    writeFile(join(outputDir, "index.md"), markdown),
  ]);
}

/** Render saved canary card/dialog/idle frames through Collie's actual phone UI. */
export async function captureScreenshots(readersRoot: string, runDir: string): Promise<ScreenshotEvidenceSummary> {
  const sourceRoot = resolve(readersRoot);
  const captureRoot = resolve(runDir);
  const outputDir = join(captureRoot, "screenshots");
  await mkdir(outputDir, { recursive: true });
  const captures = await discover(captureRoot);
  const entries: ScreenshotEntry[] = captures.map((capture) => ({
    agent: capture.agent,
    version: capture.version,
    name: capture.name,
    raw: relative(outputDir, capture.path).split("\\").join("/"),
    image: null,
    ...resultFor(capture.name, capture.agent, null),
    warnings: [],
  }));
  const errors: string[] = [];
  const summaryText = await readFile(join(captureRoot, "summary.json"), "utf8").catch(() => null);
  let summary: CanarySummary | null = null;
  if (summaryText !== null) {
    try {
      // SAFETY: summary.json is emitted by this harness from ScenarioResult[]; only its results/cases are read here.
      summary = JSON.parse(summaryText) as CanarySummary;
    } catch (error) {
      errors.push(`Could not parse summary.json: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const entry of entries) Object.assign(entry, resultFor(entry.name, entry.agent, summary));
  if (captures.length === 0) errors.push("No card, dialog, or idle ANSI captures found in this run.");

  let vite: ViteServer | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  try {
    if (captures.length > 0) {
      const webRoot = join(sourceRoot, "web");
      const installedWeb = join(REPO_ROOT, "web");
      const webRequire = createRequire(join(installedWeb, "package.json"));
      const viteModulePath = webRequire.resolve("vite");
      // SAFETY: webRequire resolves the installed Vite package from this checkout's web workspace.
      const viteModule = await import(pathToFileURL(viteModulePath).href) as ViteRuntime;
      const previousTarget = process.env.COLLIE_DEV_TARGET;
      const previousHosts = process.env.COLLIE_DEV_HOSTS;
      process.env.COLLIE_DEV_TARGET = "http://127.0.0.1:9";
      process.env.COLLIE_DEV_HOSTS = "127.0.0.1,localhost";
      try {
        const port = await freeLoopbackPort();
        vite = await viteModule.createServer({
          configFile: join(installedWeb, "vite.config.ts"),
          root: webRoot,
          logLevel: "error",
          server: { host: "127.0.0.1", port, strictPort: true, open: false },
          resolve: { alias: { "@": join(webRoot, "src") } },
        });
      } finally {
        if (previousTarget === undefined) delete process.env.COLLIE_DEV_TARGET;
        else process.env.COLLIE_DEV_TARGET = previousTarget;
        if (previousHosts === undefined) delete process.env.COLLIE_DEV_HOSTS;
        else process.env.COLLIE_DEV_HOSTS = previousHosts;
      }
      await vite.listen();
      const address = vite.httpServer?.address();
      if (address == null) throw new Error("Vite did not bind a TCP port");
      const origin = `http://127.0.0.1:${address.port}`;
      // SAFETY: SSR evaluates these fixed, owned fixture modules from readersRoot/web.
      // SAFETY: this fixed module exports installApiStub from the checked-in E2E fixture.
      const fixtureModule = await vite.ssrLoadModule<{ installApiStub(page: Page): Promise<void> }>("/e2e/fixtures/api.ts");
      // SAFETY: this fixed module exports the fixture snapshot whose runtime object is spread below.
      const handlerModule = await vite.ssrLoadModule<{ fixtureSnapshot: FixtureSnapshot }>("/src/test/handlers.ts");
      // SAFETY: @playwright/test is resolved from this checkout's web workspace.
      const playwright = webRequire("@playwright/test") as PlaywrightRuntime;
      const launched = await playwright.chromium.launch({ headless: true });
      browser = launched;
      context = await launched.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, serviceWorkers: "block" });
      let active: ScreenshotEntry | null = null;
      let activeText = "";
      await context.route("**/*", async (route: Route) => {
        const target = new URL(route.request().url());
        if (target.origin !== origin) {
          const warning = `blocked outbound request to ${target.origin}`;
          if (active !== null && !active.warnings.includes(warning)) active.warnings.push(warning);
          await route.abort();
          return;
        }
        if (target.pathname.startsWith("/api/")) {
          const warning = `blocked unstubbed API ${route.request().method()} ${target.pathname}`;
          if (active !== null && !active.warnings.includes(warning)) active.warnings.push(warning);
          await route.abort();
          return;
        }
        await route.continue();
      });
      const replayPage = await context.newPage();
      page = replayPage;
      const pageErrors: string[] = [];
      replayPage.on("pageerror", (error: Error) => pageErrors.push(error.message));
      await replayPage.setViewportSize(VIEWPORT);
      await replayPage.addInitScript(() => localStorage.setItem("collie:locale:v1", "en"));
      await fixtureModule.installApiStub(replayPage);
      const baseSnapshot = handlerModule.fixtureSnapshot;
      await replayPage.route("**/api/snapshot*", (route: Route) => {
        const snapshot = {
          ...baseSnapshot,
          agents: baseSnapshot.agents.map((agent) => agent.paneId === "w1:p1"
            ? Object.assign({}, agent, { agent: active?.agent ?? "codex", status: "idle", hasSession: true })
            : agent),
        };
        return route.fulfill({ json: snapshot });
      });
      await replayPage.route((url: URL) => decodeURIComponent(url.pathname) === "/api/pane/w1:p1", (route: Route) => {
        return route.fulfill({ json: { paneId: "w1:p1", text: activeText, truncated: false, revision: 1 } });
      });
      for (let i = 0; i < captures.length; i++) {
        const capture = captures[i]!;
        const entry = entries[i]!;
        active = entry;
        pageErrors.length = 0;
        try {
          activeText = await readFile(capture.path, "utf8");
          await replayPage.goto(`${origin}/pane/w1:p1`, { waitUntil: "domcontentloaded" });
          await replayPage.locator('[data-slot="pane-identity"]').waitFor({ state: "visible" });
          await replayPage.waitForTimeout(150);
          const folder = `${capture.agent}-${capture.version}`;
          await mkdir(join(outputDir, folder), { recursive: true });
          const image = join(outputDir, folder, `${basename(capture.name, ".ansi")}.png`);
          await replayPage.screenshot({ path: image, animations: "disabled" });
          entry.image = relative(outputDir, image).split("\\").join("/");
          if (pageErrors.length > 0) entry.warnings.push(...pageErrors.map((message) => `page error: ${message}`));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          entry.error = message;
          errors.push(`${entry.agent} ${entry.version} ${entry.name}: ${message}`);
        }
      }
      await context.close();
      context = null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Screenshot setup failed: ${message}`);
  } finally {
    if (page !== null && context !== null) await page.close().catch(() => undefined);
    if (context !== null) await context.close().catch(() => undefined);
    if (browser !== null) await browser.close().catch(() => undefined);
    if (vite !== null) await vite.close().catch(() => undefined);
  }

  await writeIndex(outputDir, captureRoot, entries, errors);
  return { captured: entries.filter((entry) => entry.image !== null).length, errors, index: join(outputDir, "index.md") };
}

if (import.meta.main) {
  const [runDir, readersRoot = REPO_ROOT] = process.argv.slice(2);
  if (runDir === "-h" || runDir === "--help") {
    console.log("Usage: bun scripts/harness-canary/screenshots.ts <run-dir> [readers-root]");
    process.exit(0);
  }
  if (runDir === undefined) {
    console.error("Usage: bun scripts/harness-canary/screenshots.ts <run-dir> [readers-root]");
    process.exit(2);
  }
  const result = await captureScreenshots(readersRoot, runDir);
  console.log(`screenshots: ${result.captured}; index: ${result.index}`);
  for (const error of result.errors) console.error(`screenshot error: ${error}`);
  if (result.errors.length > 0) process.exitCode = 1;
}
