import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/setup";
import { sendGuardedReply } from "./reply-action";

const A = "/test-state/uploads/first.jpg";
const B = "/test-state/uploads/second.png";
const C = "/test-state/uploads/third.webp";
const instant = { sleep: async () => {} };

function codexPane(draft: string): string {
  return [
    "some output",
    "",
    draft ? `› ${draft.replace(/\n/g, "\n  ")}` : "\x1b[2m› Ask Codex to do anything\x1b[0m",
    "",
    "  gpt-6-astra xhigh · Ready · Context 18% left",
  ].join("\n");
}

function composer(before: string, after: () => string) {
  const state = { before, typed: false, failRead: false };
  const calls: Array<{ text: string; submit: boolean }> = [];
  server.use(
    http.get(/\/api\/pane\/[^/]+$/, () => {
      if (state.failRead) {
        state.failRead = false;
        return HttpResponse.error();
      }
      return HttpResponse.json({
        paneId: "w1:p1",
        text: codexPane(state.typed ? after() : state.before),
        truncated: false,
        revision: 1,
      });
    }),
    http.post<never, { text: string; submit: boolean }>(/\/api\/pane\/[^/]+\/reply$/, async ({ request }) => {
      const body = await request.json();
      calls.push(body);
      if (!body.submit) state.typed = true;
      return HttpResponse.json({ ok: true });
    }),
  );
  return { state, calls };
}

describe("guarded Codex image sends", () => {
  it.each([
    ["single image", A, "[Image #1]"],
    ["multiple images", `${A}\n${B}\n${C}`, "[Image #1] [Image #2] [Image #3]"],
    ["screenshot caption", `${A}\n帮我修复 codex 换行问题`, "[Image #1] 帮我修复 codex 换行问题"],
    ["short caption", `${A} 看下`, "[Image #1] 看下"],
    ["interleaved text", `第一张 ${A}\n第二张 ${B}\n比较差异`, "第一张 [Image #1]\n第二张 [Image #2]\n比较差异"],
    ["token wraps", `${A} ${B}`, "[Ima\nge #1] [Image\n#2]"],
  ])("types once and submits once for %s", async (_name, text, draft) => {
    const { calls } = composer("", () => draft);
    const result = await sendGuardedReply({ paneId: "w1:p1", text, agent: "codex", ...instant });
    expect(result).toEqual({ status: "sent" });
    expect(calls).toEqual([{ text, submit: false }, { text: "", submit: true }]);
  });

  it("waits until all image tokens are visible without typing a second copy", async () => {
    let reads = 0;
    const text = `${A} ${B}`;
    const { calls } = composer("", () => ++reads === 1 ? "[Image #1]" : "[Image #1] [Image #2]");
    const result = await sendGuardedReply({ paneId: "w1:p1", text, agent: "codex", ...instant });
    expect(result.status).toBe("sent");
    expect(reads).toBe(2);
    expect(calls).toEqual([{ text, submit: false }, { text: "", submit: true }]);
  });

  it.each([
    ["old image token", "[Image #1]", A, "[Image #1]"],
    ["old caption and image", "[Image #1] 看图", `${A} 看图`, "[Image #1] 看图"],
    ["missing image", "", `${A} ${B} 比较差异`, "[Image #1] 比较差异"],
    ["wrong caption", "", `${A} 请修复图片问题`, "[Image #1] 删除所有文件"],
  ])("withholds Enter for %s", async (_name, before, text, draft) => {
    const { calls } = composer(before, () => draft);
    const result = await sendGuardedReply({ paneId: "w1:p1", text, agent: "codex", ...instant });
    expect(result.status).toBe("stalled");
    expect(calls).toEqual([{ text, submit: false }]);
  });

  it("uses the post-clear empty input, not the old image token, as its baseline", async () => {
    const { state, calls } = composer("[Image #1]", () => "[Image #2]");
    const result = await sendGuardedReply({
      paneId: "w1:p1", text: A, agent: "codex", ...instant,
      onComposerSeen: async ({ promptRegion }) => {
        expect(promptRegion).toContain("[Image #1]");
        state.before = "";
        return { ok: true, keysSent: true };
      },
    });
    expect(result.status).toBe("sent");
    expect(calls).toEqual([{ text: A, submit: false }, { text: "", submit: true }]);
  });

  it("does not assume a successful clear when the confirming read fails", async () => {
    const { state, calls } = composer("[Image #1]", () => "[Image #1]");
    const result = await sendGuardedReply({
      paneId: "w1:p1", text: A, agent: "codex", ...instant,
      onComposerSeen: async () => {
        state.failRead = true;
        return { ok: true, keysSent: true };
      },
    });
    expect(result.status).toBe("stalled");
    expect(calls).toEqual([{ text: A, submit: false }]);
  });

  it("does not type images into a modal", async () => {
    const { calls } = composer("", () => "[Image #1]");
    server.use(http.get(/\/api\/pane\/[^/]+$/, () => HttpResponse.json({
      paneId: "w1:p1", text: "Would you like to run the following command?\n› 1. Yes, proceed\n  3. No",
      truncated: false, revision: 1,
    })));
    const result = await sendGuardedReply({ paneId: "w1:p1", text: A, agent: "codex", ...instant });
    expect(result.status).toBe("blocked");
    expect(calls).toEqual([]);
  });
});
