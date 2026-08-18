// Set the persisted locale before React starts so assistive technology sees the correct document
// language from first paint. System remains unstored and resolves from navigator.languages.
(() => {
  try {
    const stored = localStorage.getItem("collie:language:v1");
    const supported = stored === "en" || stored === "zh-CN" || stored === "zh-TW" ? stored : null;
    let language = supported;
    if (!language) {
      const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
      const chinese = preferred.find((tag) => tag.toLowerCase().startsWith("zh"));
      if (!chinese) language = "en";
      else {
        const tag = chinese.toLowerCase();
        language =
          /(?:^|-)hant(?:-|$)/.test(tag) || /(?:^|-)(?:tw|hk|mo)(?:-|$)/.test(tag)
            ? "zh-TW"
            : "zh-CN";
      }
    }
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
  } catch {
    // Storage and navigator failures leave the static English fallback intact.
  }
})();
