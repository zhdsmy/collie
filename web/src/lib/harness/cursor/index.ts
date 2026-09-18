import type { Block, StyledLine } from "../../blocks";
import type { HarnessAdapter } from "../types";
import { extractInputDraft, extractStatusLines, stripChrome } from "./chrome";
import { decorateCursorDisplay } from "./display";

export function cursorBuildBlocks(lines: StyledLine[]): Block[] {
  return [{ kind: "raw", lines: decorateCursorDisplay(stripChrome(lines)) }];
}

export const cursorAdapter: HarnessAdapter = {
  agent: "cursor",
  displayOnly: true,
  buildBlocks: cursorBuildBlocks,
  extractStatusLines,
  extractInputDraft,
};
