import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("mobile composer chrome", () => {
  it("does not add the bottom safe-area inset to composer layout spacing", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toContain("bg-muted px-3 pb-2 pt-2.5");
    expect(composer).not.toContain("pb-[calc(env(safe-area-inset-bottom)");
  });

  it("does not reserve a label row above the composer actions", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toContain('className="mb-2 flex items-center gap-2"');
    expect(composer).not.toMatch(/<SectionLabel[^>]*>\s*Controls\s*<\/SectionLabel>/s);
  });

  it("renders the composer as a modest inset floating panel", () => {
    expect(read("src/components/composer.tsx")).toContain(
      "mx-2 mb-2 rounded-md border border-border/60 bg-muted px-3 pb-2 pt-2.5 shadow-sm",
    );
  });

  it("groups an open composer drawer into a matching inset surface", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toContain(
      "mb-2 flex flex-col overflow-hidden rounded-md border border-border/60 bg-background",
    );
    expect(composer).toContain(
      'className="flex items-center justify-between bg-muted/30 px-3 py-1.5"',
    );
    expect(composer).not.toContain("-mx-3 mb-2 flex flex-col border-t");
  });
});
