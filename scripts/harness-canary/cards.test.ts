import { expect, test } from "bun:test";
import { cardProblems, cardSpecs } from "./cards";
import type { Screen } from "./scenarios";
import type { JsonObject } from "../../web/src/lib/json";

test("native model menus must produce a card and disable the ordinary composer", () => {
  const spec = cardSpecs("codex").find((s) => s.id === "codex.model")!;
  const blocks = [{ kind: "picker", picker: { title: "Select Model and Effort" } }];
  const screen: Screen = { text: "", texts: [], lines: [], blocks, composer: false, draft: null, unread: false, rawOnly: false };
  expect(cardProblems(screen, spec)).toEqual([]);
  expect(cardProblems({ ...screen, composer: true }, spec)).toContain("ordinary composer is still enabled");
  expect(cardProblems({ ...screen, blocks: [{ kind: "raw" }] }, spec)).toEqual(["expected picker, got raw"]);
});

test("Claude model, effort, and marketplace recipes require their native menu navigation", () => {
  const specs = cardSpecs("claude");
  const menuScreen = (menu: JsonObject): Screen => {
    const blocks = [{ kind: "menu", menu }];
    return { text: "", texts: [], lines: [], blocks, composer: false, draft: null, unread: false, rawOnly: false };
  };

  const menus: [string, string, JsonObject][] = [
    ["claude.model", "Select model", { upDown: true }],
    ["claude.effort", "Effort", { upDown: false, leftRight: { values: ["low", "medium", "high"] } }],
    ["claude.marketplaces", "Manage marketplaces", { upDown: true }],
  ];
  for (const [id, title, nav] of menus) {
    const spec = specs.find((candidate) => candidate.id === id)!;
    expect(spec.kind).toBe("menu");
    expect(cardProblems(menuScreen({ title, nav }), spec)).toEqual([]);
    expect(cardProblems(menuScreen({ title }), spec).join(" ")).toContain("menu does not advertise");
  }
  expect(specs.find((candidate) => candidate.id === "claude.effort")?.minNavValues).toBe(2);
});

test("Claude autocomplete is staged without Enter and keeps its input composer available", () => {
  const spec = cardSpecs("claude").find((candidate) => candidate.id === "claude.autocomplete")!;
  expect(spec.submit).toBe(false);
  expect(spec.clearDraft).toBe(true);
  const blocks = [{ kind: "autocomplete", autocomplete: { entries: [{ name: "/model" }] } }];
  const screen: Screen = {
    text: "", texts: [], lines: [],
    blocks,
    composer: true, draft: "/model", unread: false, rawOnly: false,
  };
  expect(cardProblems(screen, spec)).toEqual([]);
  expect(cardProblems({ ...screen, composer: false }, spec)).toContain("composer is not available beneath autocomplete");
  expect(cardProblems({ ...screen, blocks: [{ kind: "raw" }] }, spec)).toEqual(["expected autocomplete, got raw"]);
});
