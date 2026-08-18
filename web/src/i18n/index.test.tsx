import { act, renderHook } from "@testing-library/react";

import {
  i18n,
  resolveSystemLanguage,
  setLanguagePreference,
  useLanguage,
} from "@/i18n";
import { resources } from "./resources";

function leafKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : leafKeys(child as object, path);
  });
}

describe("i18n resources", () => {
  it("keeps every locale structurally complete", () => {
    const english = leafKeys(resources.en.translation);
    expect(leafKeys(resources["zh-CN"].translation)).toEqual(english);
    expect(leafKeys(resources["zh-TW"].translation)).toEqual(english);
  });
});

describe("language preference", () => {
  afterEach(() => setLanguagePreference("system"));

  it.each([
    [["en-US"], "en"],
    [["en-US", "zh-CN"], "en"],
    [["zh-CN"], "zh-CN"],
    [["zh-Hans-SG"], "zh-CN"],
    [["zh-TW"], "zh-TW"],
    [["zh-Hant-HK"], "zh-TW"],
    [["ja-JP", "zh-MO"], "zh-TW"],
    [["ja-JP", "en-GB", "zh-TW"], "en"],
  ] as const)("maps browser languages %j to %s", (languages, expected) => {
    expect(resolveSystemLanguage(languages)).toBe(expected);
  });

  it("persists an explicit choice and updates i18next plus the document language", () => {
    const { result } = renderHook(() => useLanguage());

    act(() => result.current.setLanguage("zh-CN"));

    expect(result.current).toMatchObject({ preference: "zh-CN", resolved: "zh-CN" });
    expect(localStorage.getItem("collie:language:v1")).toBe("zh-CN");
    expect(i18n.resolvedLanguage).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("stores System as absence rather than a sentinel", () => {
    setLanguagePreference("zh-TW");
    const { result } = renderHook(() => useLanguage());

    act(() => result.current.setLanguage("system"));

    expect(result.current.preference).toBe("system");
    expect(localStorage.getItem("collie:language:v1")).toBeNull();
  });
});
