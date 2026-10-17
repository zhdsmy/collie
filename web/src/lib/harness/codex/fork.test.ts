import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAnsi } from "../../ansi";
import { splitLines } from "../../blocks";
import { detectForkRegion } from "./fork";

const rows = (name: string) => splitLines(parseAnsi(readFileSync(join(import.meta.dirname, "../../../fixtures/panes", name), "utf8")));

it("keeps the captured Fork picker and leaves Resume to the upstream menu", () => {
  const fork = detectForkRegion(rows("codex--v0158-fork.txt"));
  expect(fork?.model.title).toBe("Fork a previous session");
  expect(fork?.model.options.length).toBeGreaterThan(0);
  expect(detectForkRegion(rows("codex--v0158-resume.txt"))).toBeNull();
});
