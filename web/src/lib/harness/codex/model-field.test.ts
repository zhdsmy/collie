import { describe, expect, it } from "vitest";

import { parseCodexModelField, parseCodexStatuslineField } from "./model-field";

describe("parseCodexStatuslineField", () => {
  it("pairs a model with the level printed in the field beside it", () => {
    expect(parseCodexStatuslineField("gpt-5.6-sol", "high")).toEqual({
      model: "gpt-5.6-sol",
      effort: "high",
    });
    expect(parseCodexStatuslineField("gpt-5.6-sol", "Extra high")).toEqual({
      model: "gpt-5.6-sol",
      effort: "xhigh",
    });
  });

  it("leaves a neighbour that is not a level alone", () => {
    expect(parseCodexStatuslineField("gpt-5.6-sol", "Working")).toEqual({
      model: "gpt-5.6-sol",
      effort: null,
    });
    expect(parseCodexStatuslineField("gpt-6-astra xhigh", "Working")).toEqual({
      model: "gpt-6-astra",
      effort: "xhigh",
    });
    expect(parseCodexStatuslineField("gpt-6-astra xhigh", undefined)).toEqual({
      model: "gpt-6-astra",
      effort: "xhigh",
    });
  });

  it("says nothing for a field that is not a model at all", () => {
    expect(parseCodexStatuslineField("main", "high")).toBeNull();
  });
});

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

  it("reads a level no preset can name as the model with no effort", () => {
    expect(parseCodexModelField("gpt-5.6 minimal")).toEqual({ model: "gpt-5.6", effort: null });
    expect(parseCodexModelField("gpt-5.6 minimal Plan mode")).toEqual({
      model: "gpt-5.6",
      effort: null,
    });
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
