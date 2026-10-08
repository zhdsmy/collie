// Collie's own readers, loaded from a checkout at run time.
//
// The canary judges a screen with exactly the code the phone runs: `parseAnsi` + `splitLines`, the
// agent's adapter (`composerReady`, `extractInputDraft`, `draftCarriesSend`), `buildBlocks`, and the
// client's `sendGuardedReply`. They are imported by path from `<root>/web/src/lib/`, so `--readers`
// can point the same canary at an older checkout (a git worktree at v1.13.1) and show that it would
// have caught what that release missed.
//
// The imports are dynamic on purpose. The root tsconfig does not type-check web/, and a static import
// would pull the whole client into it; the few shapes used here are restated below instead.

import { join } from "node:path";

/** A parsed terminal row. Opaque here: only the readers look inside it. */
export interface Line {
  readonly segments: readonly { readonly text: string }[];
}

export interface Block {
  readonly kind: string;
}

export interface Adapter {
  readonly agent: string;
  extractInputDraft(lines: Line[]): string | null;
  composerReady?(lines: Line[]): boolean;
  draftCarriesSend?(sent: string, draft: string): boolean;
  extractStatusLines?(lines: Line[]): Line[];
}

export type ReplyOutcome =
  | { readonly status: "sent" }
  | { readonly status: "blocked" | "stalled" | "error"; readonly error: string }
  | { readonly status: "refused"; readonly reason: "offline"; readonly error: string };

export interface Readers {
  /** The checkout the readers came from. */
  readonly root: string;
  parse(text: string): Line[];
  lineText(line: Line): string;
  buildBlocks(lines: Line[], agent: string): Block[];
  adapterFor(agent: string): Adapter | undefined;
  draftCarriesSend(sent: string, draft: string | null): boolean;
  sendGuardedReply(paneId: string, text: string, agent: string): Promise<ReplyOutcome>;
}

interface AnsiModule {
  parseAnsi(input: string): readonly Line["segments"][number][];
}
interface BlocksModule {
  splitLines(segments: readonly Line["segments"][number][]): Line[];
  lineText(line: Line): string;
}
interface HarnessModule {
  buildBlocks(lines: Line[], ctx: { agent: string }): Block[];
  adapterFor(agent: string | undefined): Adapter | undefined;
}
interface ApiModule {
  fetchPane(paneId: string): Promise<{ text: string }>;
}
interface ReplyModule {
  draftCarriesSend(sent: string, draft: string | null): boolean;
  sendGuardedReply(args: { paneId: string; text: string; agent: string }): Promise<ReplyOutcome>;
}

/**
 * Import the readers from `root`. The caller must have installed the browser stand-ins and the
 * fetch shim first (transport.ts): the reply action reads `localStorage` and `document` when its
 * modules load, and every call it makes goes through `fetch`.
 */
export async function loadReaders(root: string): Promise<Readers> {
  const lib = join(root, "web", "src", "lib");
  const ansi: AnsiModule = await import(join(lib, "ansi.ts"));
  const blocks: BlocksModule = await import(join(lib, "blocks.ts"));
  const harness: HarnessModule = await import(join(lib, "harness", "index.ts"));
  const reply: ReplyModule = await import(join(lib, "reply-action.ts"));
  const api: ApiModule = await import(join(lib, "api.ts"));
  return {
    root,
    parse: (text) => blocks.splitLines(ansi.parseAnsi(text)),
    lineText: (line) => blocks.lineText(line),
    buildBlocks: (lines, agent) => harness.buildBlocks(lines, { agent }),
    adapterFor: (agent) => harness.adapterFor(agent),
    draftCarriesSend: (sent, draft) => reply.draftCarriesSend(sent, draft),
    sendGuardedReply: async (paneId, text, agent) => {
      // Use the phone's read path to establish liveness before its offline send guard runs.
      await api.fetchPane(paneId);
      return reply.sendGuardedReply({ paneId, text, agent });
    },
  };
}
