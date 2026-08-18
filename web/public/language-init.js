// Set the persisted locale before React starts so assistive technology sees the correct document
// language from first paint. System remains unstored and resolves from navigator.languages.
(() => {
  try {
    const stored = localStorage.getItem("collie:language:v1");
    const supported = stored === "en" || stored === "zh-CN" || stored === "zh-TW" ? stored : null;
    let language = supported;
    if (!language) {
      const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
      language = "en";
      for (const candidate of preferred) {
        const tag = candidate.toLowerCase();
        if (tag.startsWith("zh")) {
          language =
            /(?:^|-)hant(?:-|$)/.test(tag) || /(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(tag)
              ? "zh-TW"
              : "zh-CN";
          break;
        }
        if (tag === "en" || tag.startsWith("en-")) {
          language = "en";
          break;
        }
      }
    }
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
  } catch {
    // Storage and navigator failures leave the static English fallback intact.
  }
})();
