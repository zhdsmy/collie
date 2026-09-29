import { expect, test } from "bun:test";
import { featureHealth, healthSignature } from "./harness-watch";
import { loadCatalog, type FeatureReplayResult } from "./harness-canary/catalog";

const feature = loadCatalog().features.find((f) => f.id === "codex.model")!;
const replay: FeatureReplayResult = { id: feature.id, pass: true, status: "pass", detail: "matched", fixtures: [] };

test("old fixture success and partial live evidence never certify the current card", () => {
  const run = { version: "0.158.0", fingerprint: "source", checked: "now", evidence: "/tmp/summary.json", cases: [
    { id: "codex.model.escape", verdict: "pass" as const, detail: "restored" },
  ] };
  expect(featureHealth(feature, replay, "0.158.0").status).toBe("pending");
  expect(featureHealth(feature, replay, "0.158.0", run).status).toBe("pending");
  run.cases.push({ id: "codex.model.open", verdict: "pass", detail: "card" });
  expect(featureHealth(feature, replay, "0.158.0", run).status).toBe("pass");
  expect(featureHealth(feature, replay, "0.159.0", run).status).toBe("pending");
  expect(featureHealth(feature, { ...replay, pass: false, status: "fail" }, "0.158.0", run).status).toBe("fail");
});

test("failure/recovery notifications depend on health, not capture paths or polling time", () => {
  const pending = featureHealth(feature, replay, "0.158.0");
  expect(healthSignature([pending])).toBe(healthSignature([{ ...pending, evidence: "/tmp/new-run", detail: "a later poll" }]));
  expect(healthSignature([pending])).not.toBe(healthSignature([{ ...pending, status: "pass" }]));
  expect(healthSignature([pending])).not.toBe(healthSignature([{ ...pending, version: "0.159.0" }]));
});
