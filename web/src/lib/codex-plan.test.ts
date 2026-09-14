import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPane, fetchSnapshot, sendKeys } from "./api";
import { acquirePaneAction, releasePaneAction } from "./picker-action";
import { readCodexPlanState, runCodexPlanSwitch } from "./codex-plan";
import { fixtureSnapshot } from "@/test/handlers";

vi.mock("./api", async (importOriginal) => ({ ...await importOriginal<typeof import("./api")>(),
  fetchPane: vi.fn(), fetchSnapshot: vi.fn(), sendKeys: vi.fn() }));

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "../fixtures/panes", name), "utf8");
const off = fixture("codex--v0154-statusline-multiple-muted-default.txt");
const on = fixture("codex--v0154-statusline-single-color-plan.txt");
const modal = fixture("codex--v0154-picker-model.txt");
const session = "codex-plan-test";
const read = (text: string, key = session) => ({ text, revision: 1, paneId: "w1:p1", truncated: false, codexSessionKey: key });
const args = (enabled = true) => ({ paneId: "w1:p1", requestedLines: 200, codexSessionKey: session, enabled,
  signal: new AbortController().signal, sleep: async () => {} });

beforeEach(() => {
  vi.mocked(fetchSnapshot).mockResolvedValue({ ...fixtureSnapshot,
    agents: [{ ...fixtureSnapshot.agents[0]!, paneId: "w1:p1", agent: "codex", status: "idle" }] });
  vi.mocked(fetchPane).mockReset();
  vi.mocked(sendKeys).mockReset().mockResolvedValue({ ok: true });
});

describe("live Plan state", () => {
  it("recognizes Plan and Default from real composer footers", () => {
    expect(readCodexPlanState(on)?.enabled).toBe(true);
    expect(readCodexPlanState(off)?.enabled).toBe(false);
    expect(readCodexPlanState(on)?.prompt).toContain("Plan mode (shift+tab to cycle)");
    expect(readCodexPlanState(off)?.draft).toBeNull();
  });
  it("ignores old Plan mentions in the transcript and mode-looking prose", () => {
    expect(readCodexPlanState(off)?.enabled).toBe(false); // This capture contains old 'for Plan mode' notices.
    expect(readCodexPlanState("Plan mode (shift+tab to cycle)")).toBeNull();
    expect(readCodexPlanState(modal)).toBeNull();
  });
  it("keeps missing and working footers unknown", () => {
    expect(readCodexPlanState("")).toBeNull();
    const working = on.replace("\u001b[38;5;5mPlan mode (shift+tab to cycle)", "\u001b[2mtab to queue message 100% context left");
    expect(readCodexPlanState(working)).toBeNull();
  });
});

describe("guarded Plan switch", () => {
  it.each([true, false])("switches to %s with one bound key and verifies the native result", async (enabled) => {
    vi.mocked(fetchPane).mockResolvedValueOnce(read(enabled ? off : on)).mockResolvedValue(read(enabled ? on : off));
    expect((await runCodexPlanSwitch(args(enabled))).status).toBe("switched");
    expect(sendKeys).toHaveBeenCalledExactlyOnceWith("w1:p1", ["shift+tab"], undefined,
      readCodexPlanState(enabled ? off : on)!.prompt);
  });
  it("does not flip a mode that another client has already selected", async () => {
    vi.mocked(fetchPane).mockResolvedValue(read(on));
    expect((await runCodexPlanSwitch(args())).status).toBe("switched");
    expect(sendKeys).not.toHaveBeenCalled();
  });
  it("does not retry a toggle whose acknowledgement arrives without a changed footer", async () => {
    vi.mocked(fetchPane).mockResolvedValue(read(off));
    expect((await runCodexPlanSwitch(args())).status).toBe("unconfirmed");
    expect(sendKeys).toHaveBeenCalledTimes(1);
  });
  it("refuses a busy agent, a modal, and a host-side draft", async () => {
    vi.mocked(fetchSnapshot).mockResolvedValueOnce({ ...fixtureSnapshot,
      agents: [{ ...fixtureSnapshot.agents[0]!, paneId: "w1:p1", agent: "codex", status: "working" }] });
    expect((await runCodexPlanSwitch(args())).status).toBe("blocked");
    vi.mocked(fetchPane).mockResolvedValue(read(modal));
    expect((await runCodexPlanSwitch(args())).status).toBe("blocked");
    vi.mocked(fetchPane).mockResolvedValue(read(fixture("codex--v0154-statusline-disabled-draft.txt")));
    expect((await runCodexPlanSwitch(args())).status).toBe("blocked");
    expect(sendKeys).not.toHaveBeenCalled();
  });
  it("stops on a changed session before sending and while verifying", async () => {
    vi.mocked(fetchPane).mockResolvedValue(read(off, "different-session"));
    expect((await runCodexPlanSwitch(args())).status).toBe("changed");
    expect(sendKeys).not.toHaveBeenCalled();
    vi.mocked(fetchPane).mockResolvedValueOnce(read(off)).mockResolvedValue(read(on, "different-session"));
    expect((await runCodexPlanSwitch(args())).status).toBe("changed");
    expect(sendKeys).toHaveBeenCalledTimes(1);
  });
  it("releases its lease on cancellation and transport failure", async () => {
    const controller = new AbortController();
    vi.mocked(fetchPane).mockImplementationOnce(async () => { controller.abort(); return read(off); });
    expect((await runCodexPlanSwitch({ ...args(), signal: controller.signal })).status).toBe("cancelled");
    expect(sendKeys).not.toHaveBeenCalled();
    vi.mocked(fetchPane).mockRejectedValueOnce(new Error("offline"));
    expect((await runCodexPlanSwitch(args())).status).toBe("error");
    const owner = acquirePaneAction("w1:p1");
    expect(owner).not.toBeNull();
    releasePaneAction(owner!);
  });
  it("never interleaves with a model or picker action on the same pane", async () => {
    const owner = acquirePaneAction("w1:p1")!;
    try {
      expect((await runCodexPlanSwitch(args())).status).toBe("blocked");
      expect(sendKeys).not.toHaveBeenCalled();
    } finally { releasePaneAction(owner); }
  });
});
