import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { lineText, splitLines } from "../../blocks";
import { detectReviewRegion } from "./review";

const PANES = join(import.meta.dirname, "../../../fixtures/panes");
const parseFixture = (name: string) =>
  splitLines(parseAnsi(readFileSync(join(PANES, name), "utf8")));
const fixture = (name: string) => parseFixture(`codex--review-${name}.txt`);
const model = (name: string) => detectReviewRegion(fixture(name))!.model;

describe("Codex review picker parsing", () => {
  it("lifts the review preset list with the native pointer and PR hint", () => {
    const picker = model("scope");
    expect(picker.identity).toBe("review:preset");
    expect(picker.title).toBe("Select a review preset");
    expect(picker.options.map((option) => option.label)).toEqual([
      "Review against a base branch",
      "Review uncommitted changes",
      "Review a commit",
      "Custom review instructions",
    ]);
    expect(picker.options[0]).toMatchObject({ id: "1", pointed: true, description: "(PR Style)" });
    expect(picker.options.filter((option) => option.pointed)).toHaveLength(1);
  });

  it("lifts the base branch submenu as a single-choice picker", () => {
    const picker = model("base-branch");
    expect(picker.identity).toBe("review:base");
    expect(picker.title).toBe("Select a base branch");
    expect(picker.options).toEqual([
      expect.objectContaining({ id: "main -> main", label: "main -> main", pointed: true }),
    ]);
    expect(picker.query).toBeNull();
  });

  it("lifts the commit submenu without inventing commit metadata", () => {
    const picker = model("commit");
    expect(picker.identity).toBe("review:commit");
    expect(picker.title).toBe("Select a commit to review");
    expect(picker.options).toEqual([
      expect.objectContaining({ id: "initial review probe", label: "initial review probe", pointed: true }),
    ]);
  });

  it.each(["scope", "base-branch", "commit"])("is tail anchored for %s", (name) => {
    const lines = fixture(name);
    expect(detectReviewRegion(lines.slice(0, -1))).toBeNull();
    expect(
      detectReviewRegion([...lines, { segments: [{ text: "new output", style: {}, muted: false }] }]),
    ).toBeNull();
  });

  it("fails closed when ANSI paint or the title is missing", () => {
    const lines = fixture("scope");
    const plain = splitLines(parseAnsi(lines.map(lineText).join("\n")));
    expect(detectReviewRegion(plain)).toBeNull();
    const withoutTitle = lines.map((line) =>
      lineText(line).trim() === "Select a review preset" ? { segments: [] } : line,
    );
    expect(detectReviewRegion(withoutTitle)).toBeNull();
  });

  it("does not claim other Codex or foreign agent fixtures", () => {
    const files = readdirSync(PANES).filter(
      (name) => name.endsWith(".txt") && !name.startsWith("codex--review-"),
    );
    for (const file of files) expect(detectReviewRegion(parseFixture(file)), file).toBeNull();
  });
});
