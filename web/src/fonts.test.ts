import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { FONT_URLS } from "@/lib/sw-routes";

// Bundled fonts stay lazy and versioned. The stylesheet, service worker and disk must agree on every
// URL: a missing Nerd face produces tofu (#70), a missing selectable face silently falls back, and a
// URL the SW does not know gets swept out of the font cache on activate.

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const css = read("src/index.css");
const cssUrls = [...css.matchAll(/url\("([^"]+\.woff2)"\)/g)].map((match) => match[1]!);

describe("bundled fonts", () => {
  it("declares one Nerd face per private-use plane", () => {
    expect(css).toContain("unicode-range: U+E000-F8FF");
    expect(css).toContain("unicode-range: U+F0000-F1AFF");
  });

  it("declares both selectable webfont families", () => {
    expect(css).toContain('font-family: "Geist Mono Web"');
    expect(css).toContain('font-family: "JetBrains Mono Web"');
    expect(cssUrls).toHaveLength(6);
  });

  // Drift here is the whole failure mode: the SW sweeps every font-cache entry it cannot name, so a
  // stylesheet URL missing from FONT_URLS would be re-fetched on every cold load, forever.
  it("names the same files in the stylesheet and service worker", () => {
    expect(cssUrls).toEqual([...FONT_URLS]);
  });

  it.each(FONT_URLS)("ships %s", (url) => {
    // Throws if the asset is missing — a rename missing one side lands as fallback, not an error.
    expect(statSync(resolve(root, `public${url}`)).size).toBeGreaterThan(0);
  });

  // `[\s\S]`, not `.`: Prettier is free to wrap the array, and a newline-blind pattern would pass
  // while `woff2` sat back in the precache list.
  it("keeps woff2 out of the precache manifest", () => {
    expect(read("vite.config.ts")).not.toMatch(/globPatterns[\s\S]{0,200}?woff2/);
  });
});
