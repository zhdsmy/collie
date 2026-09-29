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

// Sanitized structural examples from live Claude Code 2.1.284 tabs (2026-09-29).
// Bodies are synthetic; the modal edge, highlighted tab, and footers match the live captures.
const modalEdge = "▔".repeat(60);
const activeTabs = (active: string) =>
  "   Settings  " + ["Status", "Config", "Usage", "Stats"].map((tab) =>
    tab === active ? `\u001b[44;1m ${tab} \u001b[0m` : tab,
  ).join("   ");

export const claudeSettingsModalScreens = [
  {
    name: "Status",
    text: [modalEdge, activeTabs("Status"), "", "Version: 2.1.284", "Session name: Example", "", "Esc to cancel"].join("\n"),
  },
  {
    name: "Config",
    text: [modalEdge, activeTabs("Config"), "", "╭" + "─".repeat(40) + "╮", "│ ⌕ Search settings…", "╰" + "─".repeat(40) + "╯",
      "Auto-compact                       true", "Show tips                          true", "↓ 16 more below", "",
      "←/→/tab to switch · ↓ to return · Esc to close"].join("\n"),
  },
  {
    name: "Usage",
    text: [modalEdge, activeTabs("Usage"), "", "Session", "Total cost: $0.00", "", "Esc to cancel"].join("\n"),
  },
  {
    name: "Stats",
    text: [modalEdge, activeTabs("Stats"), "", "Overview  Models", "All time · Last 7 days · Last 30 days", "Sessions: 1", "", "  ↓ stats"].join("\n"),
  },
  {
    name: "Stats loading",
    text: [modalEdge, activeTabs("Stats"), "", "  ✽ Loading your Claude Code stats…"].join("\n"),
  },
] as const;
