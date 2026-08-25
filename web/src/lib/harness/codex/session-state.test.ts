import { describe, expect, it } from "vitest";

import { parseAnsi } from "../../ansi";
import { splitLines } from "../../blocks";
import { parseCodexSessionState } from "./session-state";

describe("parseCodexSessionState", () => {
  it("extracts model, activity, approval and Fast from raw Codex status items", () => {
    const lines = splitLines(
      parseAnsi(
        "  gpt-5.6-sol xhigh · ~/project · Ready · Approve for me · Context 19% left · Fast off",
      ),
    );

    expect(parseCodexSessionState(lines)).toEqual({
      model: "gpt-5.6-sol",
      activity: "ready",
      approval: "Approve for me",
      fast: false,
    });
  });

  it("accepts compact Fast spelling and a working state", () => {
    const lines = splitLines(parseAnsi("gpt-5.6-terra · Working · Fast:on"));
    expect(parseCodexSessionState(lines)).toEqual({
      model: "gpt-5.6-terra",
      activity: "working",
      fast: true,
    });
  });

  it("does not mistake prose or a directory containing Auto for session state", () => {
    const lines = splitLines(parseAnsi("Auto fixes live in ~/Auto/project and use another model."));
    expect(parseCodexSessionState(lines)).toBeNull();
  });
});
