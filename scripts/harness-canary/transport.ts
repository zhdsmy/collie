// The send path: the bridge's own pane handlers, in this process, behind the client's own fetch.
//
// The client sends through the same SendProtocol as the bridge, against only the isolated
// canary's panes. No live Collie port or paired device is involved; unknown routes are refused.

import { join } from "node:path";
import { gateFor } from "../../bridge/surface/key-gate";
import { SendProtocol, SessionLocks, RowRing } from "../../bridge/surface/protocol";
import { RequestStore } from "../../bridge/surface/requests";
import { VersionCache } from "../../bridge/surface/binary-version";
import { findProfile, loadProfiles, profileFor } from "../../web/src/lib/surface/profile";
import { AuditLog } from "../../bridge/audit";
import { loadConfig, type Config } from "../../bridge/config";
import { herdrMuxFactory } from "../../bridge/mux/herdr/adapter";
import type { MuxAdapter } from "../../bridge/mux/types";
import { readPane, replyPane, keysPane, parseSendRequest } from "../../bridge/server";
import type { StateEngine } from "../../bridge/state-engine";
import { asJsonObject, asJsonString, parseJson } from "../../web/src/lib/json";
import { CANARY_SESSION, type CanarySession } from "./herdr";

const PANE_PATH = /\/api\/pane\/([^/?]+)(?:\/(reply|keys))?$/;
/** Where the client's root-absolute paths are resolved against. Never dialled. */
const ORIGIN = "http://collie-canary.invalid/";
/** The device name the audit lines carry, so a canary send is never mistaken for a phone's. */
const CANARY_DEVICE = "collie-canary";

export interface Transport {
  /** The pane as the phone reads it: `GET /api/pane/:id` through `readPane`. */
  readScreen(paneId: string): Promise<string>;
  /** The audit lines the bridge's reply handler wrote, in order. */
  readonly audit: readonly string[];
}

/**
 * Install the browser stand-ins the client modules need (a memory `localStorage`, an inert
 * `document`) and the fetch shim. Call once, before `loadReaders`.
 */
export function installTransport(session: Pick<CanarySession, "socket" | "isOwnedPane" | "paneInfo">, home: string): Transport {
  const cfg: Config = loadConfig({ HOME: home, HERDR_SOCKET_PATH: session.socket, COLLIE_MUX: "herdr" });
  const mux: MuxAdapter = herdrMuxFactory.create({ endpoint: session.socket, timeoutMs: 5000, options: {} });
  const audit: string[] = [];
  const log = new AuditLog((line) => {
    audit.push(line);
  });
  const engineStub: Partial<StateEngine> = {
    current: () => ({ agents: [], shellPanes: [], workspaces: [], tabs: [], bridge: "connected" }),
  };
  // SAFETY: readPane only calls current() to look up optional journal metadata.
  const engine = engineStub as StateEngine;

  const versions = new VersionCache();
  const protocol = new SendProtocol({
    mux, gate: gateFor(mux), store: new RequestStore(join(home, "sends")), locks: new SessionLocks(), ring: new RowRing(),
    profile: async (harness) => {
      const profile = findProfile(loadProfiles(), harness);
      return profile === undefined ? null : profileFor(harness, await versions.versionOf(profile));
    },
    generation: (paneId) => {
      if (!session.isOwnedPane(paneId)) return null;
      return `${CANARY_SESSION}:${paneId}`;
    },
  });

  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      visibilityState: "visible",
      documentElement: {},
    },
  });

  const canaryFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN);
    if (url.pathname === "/api/send" && init?.method === "POST") {
      const request = parseSendRequest(parseJson(await new Request(url, init).text()));
      if (request === null) return new Response("bad send request", { status: 400 });
      if (!session.isOwnedPane(request.pane)) throw new Error(`canary transport: refusing pane ${request.pane}, not the canary's`);
      const { pane: paneId, ...asked } = request;
      const harness = session.paneInfo(paneId).agent ?? "shell";
      const answer = await protocol.handle(asked, { session: CANARY_SESSION, paneId, harness });
      audit.push(`send ${paneId}: ${answer.receipt?.outcome ?? "pending"}`);
      return Response.json(answer);
    }
    const match = PANE_PATH.exec(url.pathname);
    if (match === null) throw new Error(`canary transport: ${url.pathname} is not a pane route`);
    const paneId = decodeURIComponent(match[1]!);
    if (!session.isOwnedPane(paneId)) throw new Error(`canary transport: refusing pane ${paneId}, not the canary's`);
    const req = new Request(url, init);
    if (match[2] === undefined && req.method === "GET") return readPane(mux, cfg, paneId, url, req, null, engine);
    if (match[2] === "reply" && req.method === "POST") {
      return replyPane(mux, cfg, paneId, req, log, CANARY_DEVICE, CANARY_SESSION);
    }
    if (match[2] === "keys" && req.method === "POST") {
      return keysPane(mux, cfg, paneId, req, log, CANARY_DEVICE, CANARY_SESSION);
    }
    throw new Error(`canary transport: ${req.method} ${url.pathname} is not routed`);
  };
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: canaryFetch });

  return {
    audit,
    async readScreen(paneId) {
      const res = await canaryFetch(`/api/pane/${encodeURIComponent(paneId)}`);
      const body = await res.text();
      if (res.status !== 200) throw new Error(`pane read ${paneId}: ${res.status} ${body.slice(0, 200)}`);
      const text = asJsonString(asJsonObject(parseJson(body))?.text);
      if (text === undefined) throw new Error(`pane read ${paneId}: no text in the reply`);
      return text;
    },
  };
}
