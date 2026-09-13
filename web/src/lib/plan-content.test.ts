import { describe, expect, it } from "vitest";
import type { TranscriptEntry } from "./types";
import { completePlanText } from "./plan-content";

const source = "# Mobile plan\n\n- Keep the existing decision controls.\n- Read the complete plan before choosing implementation.\n\nLast paragraph contains enough distinct words to verify which completed plan is currently on the terminal.";
function entry(text = source): TranscriptEntry {
  return { uuid: "plan-original", ts: "2026-09-13T00:00:00Z", role: "assistant", parts: [
    { kind: "text", text: `<proposed_plan>\n${text}\n</proposed_plan>` },
  ] };
}

describe("matching a plan to its original source", () => {
  it("restores exact Markdown after the entire visible tail matches across terminal wrapping", () => {
    const visible = "Last paragraph contains enough distinct words to verify which completed\n  plan is currently on the terminal.";
    expect(completePlanText({ text: visible, complete: false }, entry())).toBe(source);
    expect(completePlanText({ text: source, complete: true }, entry())).toBe(source);
  });

  it("refuses stale, mid-message, short and incomplete journal evidence", () => {
    expect(completePlanText({ text: "An entirely different plan is waiting for approval on this terminal screen.", complete: false }, entry())).toBeNull();
    expect(completePlanText({ text: "Keep the existing decision controls. Read the complete plan before choosing implementation.", complete: false }, entry())).toBeNull();
    expect(completePlanText({ text: "terminal.", complete: false }, entry())).toBeNull();
    expect(completePlanText({ text: source, complete: true }, null)).toBeNull();
    const truncated = entry();
    truncated.parts = [{ kind: "text", text: `<proposed_plan>${source}</proposed_plan>`, truncated: true }];
    expect(completePlanText({ text: source, complete: true }, truncated)).toBeNull();
  });

  it("does not turn ordinary prose, user text or a mismatched complete plan into the approved plan", () => {
    const ordinary = entry();
    ordinary.parts = [{ kind: "text", text: source }];
    expect(completePlanText({ text: source, complete: true }, ordinary)).toBeNull();
    expect(completePlanText({ text: source, complete: false }, entry(`An older plan.</proposed_plan>\n<proposed_plan>${source}`))).toBeNull();
    const user = entry();
    user.role = "user";
    expect(completePlanText({ text: source, complete: true }, user)).toBeNull();
    expect(completePlanText({ text: "A different opening.\n" + source, complete: true }, entry())).toBeNull();
  });
});
