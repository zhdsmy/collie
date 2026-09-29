import { asJsonString, type JsonObject } from "../../web/src/lib/json";
import { launchLine } from "./agents/profile";
import { messageById } from "./messages";
import { Driver, POLL_MS, type AgentContext, type Screen } from "./scenarios";
import { failCase, notReachedCase, passCase, type CaseResult } from "./verdict";

interface CardSpec {
  readonly id: string;
  readonly command?: string;
  readonly keys?: readonly string[];
  readonly native: RegExp;
  readonly kind: string;
  readonly title?: string;
  readonly identity?: string;
  readonly sessionAction?: string;
  readonly seeded?: boolean;
}

const CODEX: readonly CardSpec[] = [
  { id: "codex.model", command: "/model", native: /^\s*Select Model\b/m, kind: "picker" },
  { id: "codex.statusline", command: "/statusline", native: /^\s*Configure Status Line\s*$/m, kind: "picker", title: "Configure Status Line" },
  { id: "codex.resume", command: "/resume", native: /^\s*Resume a previous session\s*$/m, kind: "picker", sessionAction: "resume", seeded: true },
  { id: "codex.agents", keys: ["Left"], native: /^\s*Agent command center\s+Group:/m, kind: "picker", identity: "agents:command-center", seeded: true },
];
const CLAUDE: readonly CardSpec[] = [
  ...["Status", "Config", "Usage", "Stats"].map((title): CardSpec => ({
    id: `claude.settings.${title.toLowerCase()}`, command: `/${title.toLowerCase()}`,
    native: /^\s*Settings\s+Status\s+Config\s+Usage\s+Stats\s*$/m, kind: "unread-dialog", title,
  })),
  { id: "claude.resume", command: "/resume", native: /Resume Session|Resume a (?:previous )?session|Search conversations/i, kind: "prompt-select", seeded: true },
  { id: "claude.agents", keys: ["Left"], native: /Your conversation moved to the background/, kind: "picker", identity: "agents:claude:", seeded: true },
];
const FORK: CardSpec = { id: "codex.fork", native: /^\s*Fork a previous session\s*$/m, kind: "picker", sessionAction: "fork" };

export function cardSpecs(agent: string): readonly CardSpec[] {
  return agent === "codex" ? [...CODEX, FORK] : agent === "claude" ? CLAUDE : [];
}

/** Judge the actual block, after the native screen was reached independently of the reader. */
export function cardProblems(s: Screen, spec: CardSpec): string[] {
  const block = s.blocks.find((b) => b.kind === spec.kind);
  if (!block) return [`expected ${spec.kind}, got ${s.blocks.map((b) => b.kind).join(",")}`];
  // SAFETY: dynamic web readers produce these JSON payloads for the matched block kind.
  const payload = block as { kind: string; picker?: JsonObject; prompt?: JsonObject; viewport?: JsonObject };
  const model = payload.picker ?? payload.prompt ?? payload.viewport;
  const problems: string[] = [];
  if (!model) problems.push("card has no model");
  if (spec.title && model?.title !== spec.title) problems.push(`expected ${spec.title} tab/title`);
  if (spec.identity && !asJsonString(model?.identity)?.startsWith(spec.identity)) problems.push("wrong card identity");
  if (spec.sessionAction && model?.sessionAction !== spec.sessionAction) problems.push("wrong session action");
  if (spec.kind !== "unread-dialog" && s.unread) problems.push("fell back to the unread card");
  if (s.composer !== false) problems.push("ordinary composer is still enabled");
  return problems;
}

async function nativeScreen(d: Driver, spec: CardSpec): Promise<Screen | null> {
  const deadline = Date.now() + 15_000;
  let previous = "";
  while (Date.now() < deadline) {
    await Bun.sleep(POLL_MS * 2);
    const screen = await d.screen();
    const startup = d.ctx.profile.startupAnswer(screen.texts.filter((t) => t.trim()));
    if (startup) {
      d.keys(startup);
      previous = "";
      continue;
    }
    if (spec.native.test(screen.texts.join("\n")) && screen.text === previous) return screen;
    previous = screen.text;
  }
  d.save(`cards-${spec.id}-not-reached`, await d.screen());
  return null;
}

async function composerReturned(d: Driver): Promise<boolean> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await Bun.sleep(POLL_MS * 2);
    const screen = await d.screen();
    if (d.herdrIdle() && screen.composer === true && !screen.draft?.trim()) return true;
  }
  return false;
}

function judged(d: Driver, screen: Screen, spec: CardSpec, step: string): CaseResult {
  const file = d.save(`cards-${spec.id}-${step}`, screen);
  const problems = cardProblems(screen, spec);
  return problems.length ? failCase(`${spec.id}.${step}`, `${problems.join("; ")} (${file})`)
    : passCase(`${spec.id}.${step}`, file);
}

async function probe(d: Driver, spec: CardSpec): Promise<{ cases: CaseResult[]; clean: boolean }> {
  if (spec.command) {
    d.ctx.session.sendText(d.paneId, spec.command);
    await Bun.sleep(POLL_MS);
    d.keys(["Enter"]);
  } else d.keys(spec.keys ?? []);
  let screen = await nativeScreen(d, spec);
  const cases = [screen ? judged(d, screen, spec, "open") : notReachedCase(`${spec.id}.open`, "native screen did not settle or changed its entry layout")];
  if (screen && spec.id === "codex.model" && cardProblems(screen, spec).length === 0 &&
      screen.texts.some((t) => /^› \d+\. .+ \(current\)(?:\s|$)/.test(t))) {
    // Opening the already-current model stages its effort; no setting is confirmed.
    d.keys(["Enter"]);
    const effort = { ...spec, id: `${spec.id}.effort`, native: /^\s*Select Reasoning Level for .+$/m };
    const child = await nativeScreen(d, effort);
    cases.push(child ? judged(d, child, effort, "open") : notReachedCase(`${effort.id}.open`, "current model did not open the effort picker"));
    d.keys(["Escape"]);
    screen = await nativeScreen(d, spec);
  }
  // Arrows only stage a selection. Never confirm a model/settings change during the watcher.
  if (screen && spec.kind === "picker") {
    d.keys(["Down"]);
    const moved = await nativeScreen(d, spec);
    cases.push(moved ? judged(d, moved, spec, "navigate") : notReachedCase(`${spec.id}.navigate`, "native screen did not settle after Down"));
  }
  const beforeCancel = screen ?? await d.screen();
  if (screen || beforeCancel.composer !== true || beforeCancel.draft?.trim()) d.keys(["Escape"]);
  let clean = await composerReturned(d);
  if (!clean && spec.kind === "unread-dialog") {
    // Config's search field consumes the first Escape; the modal consumes the second.
    const remaining = await d.screen();
    if (spec.native.test(remaining.texts.join("\n"))) {
      d.keys(["Escape"]);
      clean = await composerReturned(d);
    }
  }
  const failedCapture = clean ? null : d.save(`cards-${spec.id}-escape-failed`, await d.screen());
  cases.push(clean ? passCase(`${spec.id}.escape`, "empty composer restored")
    : failCase(`${spec.id}.escape`, `Escape did not restore the empty composer (${failedCapture})`));
  return { cases, clean };
}

/** One small model turn creates an owned conversation for Resume and Agents; all probes cancel. */
export async function runCards(ctx: AgentContext): Promise<CaseResult[]> {
  const specs = cardSpecs(ctx.profile.agent);
  if (!specs.length) return [notReachedCase(`${ctx.profile.agent}.cards`, "no native card recipe registered")];
  const d = await Driver.open(ctx, `canary-${ctx.profile.agent}-cards`, ctx.options.cols, "cards");
  const cases: CaseResult[] = [];
  let clean = false;
  let seeded = false;
  try {
    const ready = await d.launch([]);
    clean = ready !== null && ready.composer === true && !ready.draft?.trim();
    for (const spec of specs.filter((s) => s !== FORK)) {
      if (spec.seeded && clean && !seeded) {
        const seed = await d.send(messageById("01-plain"));
        if (seed.result.verdict !== "pass") cases.push(notReachedCase(`${ctx.profile.agent}.cards.seed`, seed.result.detail));
        clean = seed.idleAfter || await composerReturned(d);
        seeded = clean;
      }
      if (!clean || (spec.seeded && !seeded)) {
        cases.push(notReachedCase(`${spec.id}.open`, "empty composer or seed conversation was not reached"));
        continue;
      }
      const result = await probe(d, spec);
      cases.push(...result.cases);
      clean = result.clean;
    }
  } finally {
    d.close();
  }
  if (ctx.profile.agent === "codex") {
    if (!seeded) cases.push(notReachedCase(`${FORK.id}.open`, "no seed conversation"));
    else {
      const fork = await Driver.open(ctx, "canary-codex-fork", ctx.options.cols, "fork");
      try {
        ctx.session.sendText(fork.paneId, launchLine(ctx.options.cols, "codex fork"));
        await Bun.sleep(POLL_MS);
        fork.keys(["Enter"]);
        const screen = await nativeScreen(fork, FORK);
        cases.push(screen ? judged(fork, screen, FORK, "open") : notReachedCase(`${FORK.id}.open`, "native fork picker was not reached"));
        const quit = screen?.texts.some((t) => /\bctrl\+c quit\b/.test(t));
        fork.keys(quit ? ["ctrl+c"] : ["Escape"]);
        const deadline = Date.now() + 10_000;
        let stopped = false;
        while (Date.now() < deadline && !stopped) {
          await Bun.sleep(POLL_MS * 2);
          stopped = ctx.session.paneInfo(fork.paneId).agent === null;
        }
        cases.push(stopped ? passCase(`${FORK.id}.escape`, "native quit returned to shell") : failCase(`${FORK.id}.escape`, "fork picker did not return to shell"));
      } finally { fork.close(); }
    }
  }
  return cases;
}
