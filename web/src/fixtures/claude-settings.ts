// Sanitized structural examples transcribed from Claude Code 2.1.273 screenshots (2026-09-16),
// not byte-faithful pane captures. Body values are synthetic; tab labels, rules, and key hints
// reproduce the reported native/card switching. Shared by detector and browser regressions.
const rule = "─".repeat(60);
const tabs = "Settings  Status  Config  Usage  Stats";

export const claudeSettingsScreens = [
  {
    name: "Status",
    text: [rule, tabs, "", "Version:        2.1.273", "Session name:   Example session", "", "Esc to cancel"].join("\n"),
  },
  {
    name: "Usage",
    text: [rule, tabs, "", "Session", "Total cost:     $0.00", "", "Esc to cancel"].join("\n"),
  },
  {
    name: "Config",
    text: [rule, tabs, "", "╭" + "─".repeat(40) + "╮", "│ ⌕ Search settings…", "╰" + "─".repeat(40) + "╯",
      "Auto-compact                       true", "Show tips                          true", "↓ 16 more below", "",
      "←/→/tab to switch · ↓ to return · Esc to close"].join("\n"),
  },
  {
    name: "Config scrolled",
    text: [rule, "Auto-compact                       true", "Show tips                          true", "↓ 16 more below", "",
      "←/→/tab to switch · ↓ to return · Esc to close"].join("\n"),
  },
  {
    name: "Stats",
    text: [rule, tabs, "", "Overview  Models", "Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep", "",
      "All time · Last 7 days · Last 30 days", "Sessions: 1", "",
      "↓ stats · r to cycle dates · ctrl+s to copy"].join("\n"),
  },
  {
    name: "Stats scrolled",
    text: [rule, "Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep", "", "Sessions: 1", "",
      "↓ stats · r to cycle dates · ctrl+s to copy"].join("\n"),
  },
] as const;
