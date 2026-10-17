// Collie's own readers, loaded from a checkout at run time.
//
// The canary judges a screen with exactly the code the phone runs: `parseAnsi` + `splitLines`, the
// agent's adapter (`composerReady`, `extractInputDraft`, `draftCarriesSend`), `buildBlocks`, and the
// client's `sendText`. They are imported by path from `<root>/web/src/lib/`, so `--readers`
// can compare checkouts that expose the current Send Protocol API. Historical pre-protocol
// checkouts need their own canary revision.
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
  sendText(paneId: string, text: string): Promise<ReplyOutcome>;
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
  sendText(args: { paneId: string; text: string; held: null }): Promise<
    | { status: "answered"; reading: { clear: boolean }; reply: { outcome: string | null; reason?: string } }
    | { status: "noAnswer" | "refused"; error: string }
  >;
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
  const draft: Pick<Readers, "draftCarriesSend"> = await import(join(lib, "draft-match.ts"));
  const api: ApiModule = await import(join(lib, "api.ts"));
  return {
    root,
    parse: (text) => blocks.splitLines(ansi.parseAnsi(text)),
    lineText: (line) => blocks.lineText(line),
    buildBlocks: (lines, agent) => harness.buildBlocks(lines, { agent }),
    adapterFor: (agent) => harness.adapterFor(agent),
    draftCarriesSend: draft.draftCarriesSend,
    sendText: async (paneId, text) => {
      // Use the phone's read path to establish liveness before its offline send guard runs.
      await api.fetchPane(paneId);
      const outcome = await reply.sendText({ paneId, text, held: null });
      if (outcome.status !== "answered") return { status: "error", error: outcome.error };
      return outcome.reading.clear ? { status: "sent" } : {
        status: "blocked", error: `${outcome.reply.outcome ?? "pending"}: ${outcome.reply.reason ?? "no confirmed send"}`,
      };
    },
  };
}
