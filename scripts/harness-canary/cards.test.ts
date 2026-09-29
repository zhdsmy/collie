import { expect, test } from "bun:test";
import { cardProblems, cardSpecs } from "./cards";
import type { Screen } from "./scenarios";

test("native model menus must produce a card and disable the ordinary composer", () => {
  const spec = cardSpecs("codex").find((s) => s.id === "codex.model")!;
  const blocks = [{ kind: "picker", picker: { title: "Select Model and Effort" } }];
  const screen: Screen = { text: "", texts: [], lines: [], blocks, composer: false, draft: null, unread: false, rawOnly: false };
  expect(cardProblems(screen, spec)).toEqual([]);
  expect(cardProblems({ ...screen, composer: true }, spec)).toContain("ordinary composer is still enabled");
  expect(cardProblems({ ...screen, blocks: [{ kind: "raw" }] }, spec)).toEqual(["expected picker, got raw"]);
});
