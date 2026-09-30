import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type AdaptationOrigin = "upstream" | "upstream-patched" | "downstream" | "shared";

export interface FixtureExpectation {
  block?: string;
  identity?: string;
  title?: string;
  minOptions?: number;
  scaleMin?: number;
  sessionInfo?: "history" | "startup" | "startup-tail";
  viewportTitle?: string;
  viewportNonEmpty?: boolean;
  statusLinesMin?: number;
  surface?: "diff" | "user";
}

export interface AdaptationFixture {
  path: string;
  agent: string;
  expect: FixtureExpectation;
}

export interface AdaptationFeature {
  id: string;
  agent: string;
  origin: AdaptationOrigin;
  sources: string[];
  tests: string[];
  fixtures: AdaptationFixture[];
  live: boolean;
  liveCase?: string;
  liveChecks?: string[];
  verified: { version: string; date: string; how: string; evidence: string } | null;
}

export interface AdaptationCatalog {
  features: AdaptationFeature[];
}

export interface FixtureReplayResult {
  path: string;
  pass: boolean;
  detail: string;
}

export interface FeatureReplayResult {
  id: string;
  pass: boolean;
  status: "pass" | "fail" | "unverified";
  detail: string;
  fixtures: FixtureReplayResult[];
}

const REPO_ROOT = resolve(import.meta.dirname, "../..");
type RuntimeLine = { segments: { text: string }[]; surface?: { kind: string } };
type RuntimeBlock = {
  kind: string;
  lines: RuntimeLine[];
  picker?: { identity?: string; title?: string; options?: unknown[] };
  prompt?: { caption?: string; question?: string; options?: unknown[] };
  menu?: { title?: string; actions?: unknown[]; nav?: { leftRight?: { values?: string[] } } };
  wizard?: { phase: string; question?: string; options?: unknown[]; answers?: unknown[] };
  multi?: { phase: string; question?: string; options?: unknown[] };
  preview?: { question?: string; options?: unknown[] };
  autocomplete?: { entries?: unknown[] };
  sessionInfo?: { kind: string };
  viewport?: { title: string; lines: RuntimeLine[] };
};

interface ReplayReaders {
  parse(text: string): RuntimeLine[];
  lineText(line: RuntimeLine): string;
  buildBlocks(lines: RuntimeLine[], agent: string): RuntimeBlock[];
  adapterFor(agent: string): { extractStatusLines(lines: RuntimeLine[]): RuntimeLine[] } | undefined;
}

export function loadCatalog(): AdaptationCatalog {
  // SAFETY: checked-in metadata; catalog.test.ts validates its references and replays its assertions.
  return JSON.parse(readFileSync(new URL("./adaptations.json", import.meta.url), "utf8")) as AdaptationCatalog;
}

export const features = loadCatalog().features;

async function loadReplayReaders(root: string): Promise<ReplayReaders> {
  const lib = join(root, "web", "src", "lib");
  const [ansi, blocks, harness] = await Promise.all([
    import(join(lib, "ansi.ts")),
    import(join(lib, "blocks.ts")),
    import(join(lib, "harness", "index.ts")),
  ]);
  return {
    parse: (text) => blocks.splitLines(ansi.parseAnsi(text)),
    lineText: (line) => blocks.lineText(line),
    buildBlocks: (lines, agent) => harness.buildBlocks(lines, { agent, nativeMirror: true }),
    adapterFor: (agent) => harness.adapterFor(agent),
  };
}

interface ReplayModel {
  identity?: string;
  title?: string;
  optionCount?: number;
  scaleCount?: number;
}

function blockModel(block: RuntimeBlock): ReplayModel {
  switch (block.kind) {
    case "picker": return { identity: block.picker?.identity, title: block.picker?.title, optionCount: block.picker?.options?.length };
    case "prompt-select": return { title: block.prompt?.caption ?? block.prompt?.question, optionCount: block.prompt?.options?.length };
    case "menu": return { title: block.menu?.title, optionCount: block.menu?.actions?.length, scaleCount: block.menu?.nav?.leftRight?.values?.length };
    case "wizard": return block.wizard?.phase === "question"
      ? { title: block.wizard.question, optionCount: block.wizard.options?.length }
      : { title: "Submit review", optionCount: block.wizard?.answers?.length };
    case "multi-select": return { title: block.multi?.question, optionCount: block.multi?.phase === "checkbox" ? block.multi.options?.length : 0 };
    case "preview-select": return { title: block.preview?.question, optionCount: block.preview?.options?.length };
    case "autocomplete": return { optionCount: block.autocomplete?.entries?.length };
    default: return {};
  }
}

async function replayFixture(fixture: AdaptationFixture, readers: ReplayReaders, root: string): Promise<FixtureReplayResult> {
  const input = readFileSync(resolve(root, fixture.path), "utf8");
  const lines = readers.parse(input);
  const blocks = readers.buildBlocks(lines, fixture.agent);
  const expected = fixture.expect;
  const target = expected.block ? blocks.find((block) => block.kind === expected.block) : blocks[0];
  const failures: string[] = [];

  if (expected.block && !target) failures.push(`expected ${expected.block} block`);
  if (expected.identity && (!target || blockModel(target).identity !== expected.identity)) {
    failures.push(`expected identity ${expected.identity}`);
  }
  if (expected.title && (!target || blockModel(target).title !== expected.title)) {
    failures.push(`expected title ${expected.title}`);
  }
  if (expected.minOptions !== undefined) {
    const count = target ? blockModel(target).optionCount ?? 0 : 0;
    if (count < expected.minOptions) failures.push(`expected at least ${expected.minOptions} options, found ${count}`);
  }
  if (expected.scaleMin !== undefined) {
    const count = target ? blockModel(target).scaleCount ?? 0 : 0;
    if (count < expected.scaleMin) failures.push(`expected at least ${expected.scaleMin} scale values, found ${count}`);
  }
  if (expected.sessionInfo) {
    const folded = blocks.some((block) => block.kind === "raw" && block.sessionInfo?.kind === expected.sessionInfo);
    if (!folded) failures.push(`expected folded ${expected.sessionInfo} session info`);
  }
  if (expected.viewportTitle || expected.viewportNonEmpty) {
    const dialog = blocks.find((block) => block.kind === "unread-dialog");
    if (!dialog?.viewport) failures.push("expected a bounded unread-dialog viewport");
    else {
      if (expected.viewportTitle && dialog.viewport.title !== expected.viewportTitle) {
        failures.push(`expected viewport title ${expected.viewportTitle}, found ${dialog.viewport.title}`);
      }
      if (expected.viewportNonEmpty && dialog.viewport.lines.every((line) => readers.lineText(line).trim() === "")) {
        failures.push("expected nonempty viewport content");
      }
    }
  }
  if (expected.statusLinesMin !== undefined) {
    const count = readers.adapterFor(fixture.agent)?.extractStatusLines(lines).length ?? 0;
    if (count < expected.statusLinesMin) failures.push(`expected at least ${expected.statusLinesMin} status lines, found ${count}`);
  }
  if (expected.surface) {
    const found = blocks.some((block) => block.lines.some((line) => line.surface?.kind === expected.surface));
    if (!found) failures.push(`expected ${expected.surface} display surface`);
  }

  return {
    path: fixture.path,
    pass: failures.length === 0,
    detail: failures.length === 0 ? "expectation matched" : failures.join("; "),
  };
}

export async function replayCatalog(catalog: AdaptationCatalog = loadCatalog(), root = REPO_ROOT): Promise<FeatureReplayResult[]> {
  const readers = await loadReplayReaders(root);
  return Promise.all(catalog.features.map(async (feature) => {
    if (feature.fixtures.length === 0) {
      return { id: feature.id, pass: false, status: "unverified", detail: "no captured replay fixture", fixtures: [] };
    }
    const fixtures = await Promise.all(feature.fixtures.map((fixture) => replayFixture(fixture, readers, root)));
    const failed = fixtures.filter((fixture) => !fixture.pass);
    return {
      id: feature.id,
      pass: failed.length === 0,
      status: failed.length === 0 ? "pass" : "fail",
      detail: failed.length === 0 ? `${fixtures.length} fixture(s) matched` : failed.map((fixture) => `${fixture.path}: ${fixture.detail}`).join("; "),
      fixtures,
    };
  }));
}
