import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { splitLines } from "../../blocks";
import { codexBuildBlocks } from ".";
import { detectCodexMenu } from "./menu";

const FIXTURE = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "panes",
  "codex--menu-model-picker.txt",
);
const lines = () => splitLines(parseAnsi(readFileSync(FIXTURE, "utf8")));

describe("Codex selector menu", () => {
  it("lifts the live model picker with navigation and only its commit/cancel keys", () => {
    expect(detectCodexMenu(lines())).toEqual(
      expect.objectContaining({
        title: "Select Model and Effort",
        actions: [
          { label: "Confirm", keys: ["Enter"] },
          { label: "Go back", keys: ["Escape"], cancel: true },
        ],
        nav: { upDown: true },
      }),
    );
    expect(detectCodexMenu(lines())!.actions.flatMap((action) => action.keys)).not.toContain("1");
  });

  it("keeps transcript above the picker raw and lifts the selector last", () => {
    expect(codexBuildBlocks(lines()).map((block) => block.kind)).toEqual(["raw", "menu"]);
  });

  it("declines the same words without the picker's bold title", () => {
    const plain = readFileSync(FIXTURE, "utf8").replace(/\x1b\[1m|\x1b\[0m/g, "");
    expect(detectCodexMenu(splitLines(parseAnsi(plain)))).toBeNull();
  });
});
