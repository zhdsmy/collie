// Synthetic display sample based on Claude's numbered +/- layout in the 2026-09-12
// screenshot. No user code or conversation is copied; ANSI palettes are test inputs.
const esc = "\u001b[";
const reset = `${esc}0m`;
const removed = `${esc}48;2;48;0;0m`;
const added = `${esc}48;2;0;40;0m`;

export const claudeDiffSample = [
  "● Update(sample.ts)",
  "  ⎿  Added 2 lines, removed 3 lines",
  "      4   const unchanged = true;",
  `     ${removed}${esc}38;2;255;100;100m 5 - ${esc}38;2;248;248;242mconst oldValue = ${esc}48;2;90;0;0mfalse${removed};${reset}`,
  `     ${removed}${esc}38;2;255;100;100m 6 - ${esc}38;2;248;248;242m// old documentation https://example.com/old${reset}`,
  `     ${removed}${esc}38;2;255;100;100m 7 - ${reset}`,
  `     ${added}${esc}38;2;100;255;100m 5 + ${esc}38;2;248;248;242mconst newValue = ${esc}38;2;180;140;255mtrue${esc}38;2;248;248;242m;${reset}`,
  `     ${added}${esc}38;2;100;255;100m 6 + ${esc}38;2;248;248;242m// 新增说明 ${"long added content ".repeat(8)}${reset}`,
  "      7   return unchanged;",
  "  ⎿  No diagnostic issues found",
].join("\n");
