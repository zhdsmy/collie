import { describe, expect, it } from "vitest";

import { parseCodexModelField } from "./model-field";

describe("parseCodexModelField", () => {
  it.each([
    ["gpt-6-astra", { model: "gpt-6-astra", effort: null }],
    ["gpt-6-astra xhigh", { model: "gpt-6-astra", effort: "xhigh" }],
    ["gpt-6-astra Extra high", { model: "gpt-6-astra", effort: "xhigh" }],
    ["gpt-5.6-luna max", { model: "gpt-5.6-luna", effort: "max" }],
    ["gpt-5.6-luna ultra", { model: "gpt-5.6-luna", effort: "ultra" }],
    ["gpt-5.6-sol Plan mode (shift+tab to cycle)", { model: "gpt-5.6-sol", effort: null }],
    ["gpt-6-astra xhigh Plan mode", { model: "gpt-6-astra", effort: "xhigh" }],
    ["gpt-6-astra (current)", { model: "gpt-6-astra", effort: null }],
    ["gpt-6-astra (default)", { model: "gpt-6-astra", effort: null }],
  ] as const)("parses %s", (text, expected) => {
    expect(parseCodexModelField(text)).toEqual(expected);
  });

  it("accepts custom models only when the caller knows them", () => {
    expect(parseCodexModelField("my-local-model high", ["my-local-model"])).toEqual({
      model: "my-local-model",
      effort: "high",
    });
    expect(parseCodexModelField("my-local-model")).toBeNull();
  });

  it.each([
    "main",
    "/tmp/worktree",
    "Model changed gpt-6-astra xhigh",
    "gpt-6-astra unknown",
    "gpt-6-astra xhigh extra",
    "gpt-",
  ])("does not misclassify %s", (text) => {
    expect(parseCodexModelField(text)).toBeNull();
  });

  it("matches the longest known model first", () => {
    expect(parseCodexModelField("gpt-5.6-luna-pro xhigh", ["gpt-5.6", "gpt-5.6-luna-pro"])).toEqual({
      model: "gpt-5.6-luna-pro",
      effort: "xhigh",
    });
  });
});
