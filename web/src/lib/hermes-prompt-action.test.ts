import { readFileSync } from "node:fs";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { server } from "@/test/setup";
import { parseAnsi } from "./ansi";
import { splitLines } from "./blocks";
import { hermesAdapter } from "./harness/hermes";
import { submitPromptOption } from "./prompt-action";

const capture = readFileSync(join(import.meta.dirname, "../fixtures/panes/hermes--clarify-q0.txt"), "utf8");
const next = readFileSync(join(import.meta.dirname, "../fixtures/panes/hermes--clarify-q1.txt"), "utf8");
const other = readFileSync(join(import.meta.dirname, "../fixtures/panes/hermes--clarify-other.txt"), "utf8");
function model(text: string) {
  const block = hermesAdapter.buildBlocks(splitLines(parseAnsi(text))).find((b) => b.kind === "prompt-select");
  if (!block || block.kind !== "prompt-select") throw new Error("Expected Hermes choice card");
  return block.prompt;
}

it("sends only the tapped digit with the freshly read Hermes frame bound to the write", async () => {
  const current = capture.replace("Tab next question", "Tab next question (87s)");
  const writes: unknown[] = [];
  server.use(
    http.get("/api/pane/:id", () => HttpResponse.json({ paneId: "w1:p1", text: current, revision: 1, truncated: false })),
    http.post("/api/pane/:id/keys", async ({ request }) => {
      writes.push(await request.json());
      return HttpResponse.json({ ok: true });
    }),
  );
  const prompt = model(capture);
  const result = await submitPromptOption({ paneId: "w1:p1", requestedLines: 200, detectedRevision: 1, agent: "hermes", prompt, option: prompt.options[1]! });
  expect(result.status).toBe("sent");
  expect(writes).toEqual([{ keys: ["2"], expected_prompt: model(current).regionSignature }]);
});

it.each([next, other, capture.replace("显示摘要", "Different choice"), "Hermes finished the question."])(
  "refuses a stale choice without writing any keys", async (current) => {
    let writes = 0;
    server.use(
      http.get("/api/pane/:id", () => HttpResponse.json({ paneId: "w1:p1", text: current, revision: 1, truncated: false })),
      http.post("/api/pane/:id/keys", () => { writes++; return HttpResponse.json({ ok: true }); }),
    );
    const prompt = model(capture);
    const result = await submitPromptOption({ paneId: "w1:p1", requestedLines: 200, detectedRevision: 1, agent: "hermes", prompt, option: prompt.options[1]! });
    expect(result.status).toBe("changed");
    expect(writes).toBe(0);
  },
);
