import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("mobile composer chrome", () => {
  it("extends only the closed-keyboard background into the bottom safe area", () => {
    const composer = read("src/components/composer.tsx");
    const agentChat = read("src/components/agent-chat.tsx");
    const messageList = read("src/components/ui/chat/chat-message-list.tsx");
    expect(agentChat).toContain(
      "const { open: keyboardOpen, offsetTop: keyboardViewportTop } = useKeyboardViewport()",
    );
    expect(composer).toContain("keyboardOpen = false");
    expect(composer).toContain('? "mb-2 pb-2"');
    expect(composer).toContain(
      '"mb-[calc(0.5rem_-_env(safe-area-inset-bottom))] pb-[calc(0.5rem_+_env(safe-area-inset-bottom))]"',
    );
    expect(agentChat).toContain("max-w-[100dvw] flex-1 flex-col overflow-x-clip");
    expect(agentChat).not.toContain("max-w-[100dvw] flex-1 flex-col overflow-x-hidden");
    expect(messageList).toContain(
      "overflow-y-auto overflow-x-hidden overscroll-y-contain",
    );
  });

  it("does not reserve a label row above the composer actions", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toMatch(
      /<div className="mb-2 flex[^"\n]*\bmin-w-0\b[^"\n]*\bitems-center\b/,
    );
    expect(composer).not.toMatch(/<SectionLabel[^>]*>\s*Controls\s*<\/SectionLabel>/s);
  });

  it("renders the composer as a modest inset floating panel", () => {
    const composer = read("src/components/composer.tsx");
    expect(composer).toContain(
      "mx-2 rounded-md border border-border/60 bg-muted shadow-sm",
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

describe("top safe area ownership", () => {
  it("does not repeat the notch inset below an in-flow top banner", () => {
    const rootRoute = read("src/routes/root.tsx");
    const header = read("src/components/app-header.tsx");
    const updateBanner = read("src/components/update-available-banner.tsx");
    const connectionBanner = read("src/components/connection-banner.tsx");
    const css = read("src/index.css");

    expect(rootRoute).toContain('className="app-shell flex h-[100dvh] flex-col"');
    expect(header).toContain("app-header flex items-center");
    expect(updateBanner).toContain("data-top-banner");
    expect(connectionBanner.match(/data-top-banner/g)).toHaveLength(2);
    expect(css).toContain(".app-shell:has(> [data-top-banner]) .app-header");
    expect(css).toContain(
      ".app-shell > [data-top-banner] ~ [data-top-banner] .app-top-banner-row",
    );
  });
});
