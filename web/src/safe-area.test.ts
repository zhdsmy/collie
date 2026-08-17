import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("mobile composer chrome", () => {
  it("extends only the closed-keyboard background into the bottom safe area", () => {
    const composer = read("src/components/composer.tsx");
    const agentChat = read("src/components/agent-chat.tsx");
    expect(composer).toContain("const keyboardOpen = useKeyboardOpen()");
    expect(composer).toContain('? "mb-2 pb-2"');
    expect(composer).toContain(
      '"mb-[calc(0.5rem_-_env(safe-area-inset-bottom))] pb-[calc(0.5rem_+_env(safe-area-inset-bottom))]"',
    );
    expect(agentChat).toContain("max-w-[100dvw] flex-1 flex-col overflow-x-clip");
    expect(agentChat).not.toContain("max-w-[100dvw] flex-1 flex-col overflow-x-hidden");
  });

  it("does not reserve a label row above the composer actions", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toContain('className="mb-2 flex items-center gap-2"');
    expect(composer).not.toMatch(/<SectionLabel[^>]*>\s*Controls\s*<\/SectionLabel>/s);
  });

  it("renders the composer as a modest inset floating panel", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toContain(
      "mx-2 rounded-md border border-border/60 bg-muted px-3 pt-2.5 shadow-sm",
    );
    expect(composer).toContain('keyboardOpen\n            ? "mb-2 pb-2"');
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
