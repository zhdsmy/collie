import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { parseAnsi } from "../../ansi";
import { splitLines } from "../../blocks";
import { hermesAdapter } from "./index";

const load = (name: string) => splitLines(parseAnsi(readFileSync(join(import.meta.dirname,
  "../../../fixtures/panes", `hermes--clarify-${name}.txt`), "utf8")));

it.each(["q0", "q1", "single"])("keeps the unsupported historical %s panel raw", (name) => {
  expect(hermesAdapter.buildBlocks(load(name)).every((b) => b.kind === "raw")).toBe(true);
});

it("uses the native composer for a current Other answer", () => {
  const rows = load("other");
  expect(hermesAdapter.buildBlocks(rows).every((b) => b.kind === "raw")).toBe(true);
  expect(hermesAdapter.composerReady!(rows)).toBe(true);
  expect(hermesAdapter.displayOnly).not.toBe(true);
});
