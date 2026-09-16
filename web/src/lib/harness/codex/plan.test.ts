import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { completePlanText } from "../../plan-content";
import { pickersEqual, pickersSameIdentity } from "../picker-model";
import { detectPlanRegion } from "./plan";
import entries from "../../../fixtures/codex-plan-transcript.json";
import type { TranscriptEntry } from "../../types";

function lines(state: string) {
  return splitLines(parseAnsi(readFileSync(join(import.meta.dirname, "../../../fixtures/panes", `codex--v0154-plan-${state}.txt`), "utf8")));
}
function model(state: string) {
  const result = detectPlanRegion(lines(state));
  if (!result) throw new Error(`Plan not detected: ${state}`);
  return result.model;
}
// SAFETY: these are the reviewed entries captured through the real Codex journal adapter.
const transcript = entries as TranscriptEntry[];

// Structural mutation of native plan captures: resume inserts this separately styled recap.
function withRecap(state = "short") {
  const capture = lines(state);
  const title = capture.findIndex((line) => lineText(line).trim() === "Implement this plan?");
  capture.splice(title, 0, ...splitLines(parseAnsi([
    "\u001b[2m────────────────────────────────\u001b[0m",
    "",
    "\u001b[2m──── \u001b[22;1mConversation recap\u001b[22;2m ────\u001b[0m",
    "",
    "Review the **scope** before implementation.",
    "",
    "Keep the existing behavior.",
    "",
  ].join("\n"))));
  return capture;
}

describe("Codex proposed-plan cards", () => {
  it("keeps a resumed recap separate from the plan and its verified original", () => {
    for (const state of ["short", "long"]) {
      const result = detectPlanRegion(withRecap(state))!.model;
      expect(result.plan).toEqual({ ...model(state).plan, recap: "Review the **scope** before implementation.\n\nKeep the existing behavior." });
      expect(result.options).toEqual(model(state).options);
      expect(result.regionSignature).toContain("Conversation recap");
      expect(completePlanText(result.plan!, transcript[state === "short" ? 0 : 1]!)).not.toBeNull();
    }
  });

  it("keeps recap identity across pointer moves but refuses changed context", () => {
    const first = detectPlanRegion(withRecap())!.model;
    const second = detectPlanRegion(withRecap("short-second"))!.model;
    expect(pickersSameIdentity(first, second)).toBe(true);
    expect(pickersEqual(first, second)).toBe(false);
    const changed = { ...first, plan: { ...first.plan!, recap: "Different context" } };
    expect(pickersSameIdentity(first, changed)).toBe(false);
    expect(pickersEqual(first, changed)).toBe(false);
    expect(pickersSameIdentity(first, model("short"))).toBe(false);
  });

  it("accepts the native completion rule with or without a recap", () => {
    const resumed = withRecap();
    const separator = resumed.findIndex((line) => /^─+$/.test(lineText(line)));
    resumed.splice(separator, 1, ...splitLines(parseAnsi("\u001b[2m──── Worked for 12s ────\u001b[0m")));
    expect(detectPlanRegion(resumed)?.model.plan?.text).toBe(model("short").plan?.text);
    const plain = lines("short");
    const title = plain.findIndex((line) => lineText(line).trim() === "Implement this plan?");
    plain.splice(title, 0, ...splitLines(parseAnsi("\u001b[2m──── Worked for 12s ────\u001b[0m")));
    expect(detectPlanRegion(plain)?.model.plan).toEqual(model("short").plan);
  });

  it("refuses unstyled recaps, unrelated interstitials and a recap without a plan", () => {
    const unstyled = withRecap().map((line) => lineText(line).includes("Conversation recap")
      ? splitLines(parseAnsi(lineText(line)))[0]! : line);
    expect(detectPlanRegion(unstyled)).toBeNull();
    const unrelated = withRecap();
    const rule = unrelated.findIndex((line) => /^─+$/.test(lineText(line)));
    unrelated.splice(rule, 0, ...splitLines(parseAnsi("Unrelated output")));
    expect(detectPlanRegion(unrelated)).toBeNull();
    const recapOnly = withRecap();
    expect(detectPlanRegion(recapOnly.slice(recapOnly.findIndex((line) => /^─+$/.test(lineText(line)))))).toBeNull();
    const extraTail = [...withRecap(), ...splitLines(parseAnsi("New response"))];
    expect(detectPlanRegion(extraTail)).toBeNull();
  });

  it("lifts the complete short plan and all native decisions without a timing divider", () => {
    const plan = model("short");
    expect(plan.plan?.complete).toBe(true);
    expect(plan.plan?.text).toContain('const action = "review before implementation";');
    expect(plan.options.map((option) => option.label)).toEqual([
      "Yes, implement this plan", "Yes, clear context and implement", "No, stay in Plan mode",
    ]);
    expect(plan.options[1]?.description).toBe("Fresh thread with this plan.");
    expect(completePlanText(plan.plan!, transcript[0]!)).toContain("```ts");
  });

  it("restores a clipped long plan only from its matching complete journal source", () => {
    const plan = model("long").plan!;
    expect(plan.complete).toBe(false);
    expect(plan.text).not.toContain("Opening section");
    const original = completePlanText(plan, transcript[1]!);
    expect(original).toContain("Opening section");
    expect(original).toContain("Step 24");
    expect(original!.length).toBeGreaterThan(plan.text.length * 4);
    expect(completePlanText(plan, transcript[0]!)).toBeNull();
  });

  it("binds decisions to plan content while allowing guarded native pointer moves", () => {
    const first = model("short");
    const second = model("short-second");
    const third = model("short-third");
    expect(second.options.find((option) => option.pointed)?.id).toBe("2");
    expect(third.options.find((option) => option.pointed)?.id).toBe("3");
    expect(pickersSameIdentity(first, second)).toBe(true);
    expect(pickersEqual(first, second)).toBe(false);
    expect(pickersSameIdentity(first, model("long"))).toBe(false);
    expect(pickersSameIdentity(first, { ...first, plan: { ...first.plan!, complete: false } })).toBe(false);
  });

  it("refuses closed, disabled, partial and unpainted lookalike menus", () => {
    expect(detectPlanRegion(lines("implemented"))).toBeNull();
    expect(detectPlanRegion(lines("cleared"))).toBeNull();
    expect(detectPlanRegion(lines("stayed"))).toBeNull();
    const disabled = lines("short");
    const description = disabled.flatMap((line) => line.segments).find((segment) => segment.text.includes("Fresh thread with this plan."))!;
    description.text = description.text.replace("Fresh thread with this plan.", "Default mode unavailable");
    expect(detectPlanRegion(disabled)).toBeNull();
    const partial = lines("short").filter((line) => !lineText(line).includes("2. Yes, clear context"));
    expect(detectPlanRegion(partial)).toBeNull();
    const plain = splitLines(parseAnsi(lines("short").map(lineText).join("\n")));
    expect(detectPlanRegion(plain)).toBeNull();
  });
});
