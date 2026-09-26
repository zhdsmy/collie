// Sanitized 0.156.1 screen shape observed in isolated `codex resume` and in-session `/resume`.
export function codexResumeFrame(exit: "start new" | "exit", query = "", matches = false): string {
  return [
    " \x1b[1mResume a previous session\x1b[0m",
    "",
    " Filter:  Cwd  All    Status:  Active  Archived    Sort:  Updated  Created",
    "",
    query ? ` Search: ${query}` : " Type to search",
    "",
    ...(query && !matches ? ["  No results for your search"] : [
      "  \x1b[1m› \x1b[22m4d ago      Refactor the picker row formatter",
      ...(!query ? ["    5d ago      Explain the fixture grammar"] : []),
    ]),
    `\x1b[2m${"─".repeat(60)}\x1b[0m\x1b[38;2;135;140;164m ${query ? matches ? "1 / 1" : "0 / 0" : "1 / 2"} · 100% \x1b[0m\x1b[2m─\x1b[0m`,
    ` enter resume   ${query ? "esc clear search" : `esc ${exit}`}   ctrl+c quit   tab focus   ←/→ option`,
    " ctrl+o comfy   ctrl+t preview   ctrl+e exp   ↑/↓ browse",
  ].join("\n");
}
