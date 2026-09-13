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

describe("Codex proposed-plan cards", () => {
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
