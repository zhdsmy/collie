import languageInit from "../../public/language-init.js?raw";

function firstPaintLanguage(stored: string | null, languages: string[]): string {
  const root = { lang: "en", dir: "ltr" };
  const run = new Function("localStorage", "navigator", "document", languageInit);
  run(
    { getItem: () => stored },
    { language: languages[0] ?? "", languages },
    { documentElement: root },
  );
  return root.lang;
}

describe("first-paint language initialization", () => {
  it("honors an explicit persisted choice", () => {
    expect(firstPaintLanguage("zh-TW", ["en-US"])).toBe("zh-TW");
  });

  it("chooses the first supported system language in browser priority order", () => {
    expect(firstPaintLanguage(null, ["en-US", "zh-CN"])).toBe("en");
    expect(firstPaintLanguage(null, ["ja-JP", "zh-Hant-HK"])).toBe("zh-TW");
  });
});
