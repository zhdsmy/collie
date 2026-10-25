import { act, fireEvent, render, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { claudeHintText, extractStatusLines } from "@/lib/harness/claude/chrome";
import { __resetLocale, setLocale, whenLocaleReady, type Locale } from "@/lib/i18n";
import { StatuslineRow, UsageFields } from "./statusline-row";

beforeEach(() => __resetLocale());

it.each([false, true])("shows native last-turn TTFT with mode controls: %s", (controlled) => {
  const row = splitLines(parseAnsi("gpt-6-astra xhigh · Ready · main"))[0]!;
  const props = { agent: "codex", row, codexControls: controlled ? {
    plan: { enabled: false, busy: false, onClick: vi.fn() },
    fast: { enabled: false, busy: false, onClick: vi.fn() },
  } : undefined };
  const view = render(<StatuslineRow {...props} lastTurnFirstTokenMs={4166} />);
  expect(view.getByRole("img", { name: "Latest completed turn: first token 4.2s" })).toHaveTextContent("4.2s");
  for (const ms of [undefined, NaN, -1, Infinity]) {
    view.rerender(<StatuslineRow {...props} lastTurnFirstTokenMs={ms} />);
    expect(view.queryByRole("img", { name: /first token/ })).toBeNull();
  }
  view.rerender(<StatuslineRow {...props} lastTurnFirstTokenMs={0} />);
  expect(view.getByRole("img", { name: "Latest completed turn: first token 0.0s" })).toBeVisible();
  view.rerender(<StatuslineRow {...props} agent="hermes" lastTurnFirstTokenMs={4166} />);
  expect(view.queryByRole("img", { name: /first token/ })).toBeNull();
});

it("opens the model menu only from a recognized Codex model field", () => {
  const open = vi.fn();
  const row = splitLines(parseAnsi("gpt-6-astra xhigh · Context 85% left · main"))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} onModelClick={open} />);
  const button = view.getByRole("button");
  expect(button).toHaveTextContent("gpt-6-astra xhigh");
  expect(button).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(button);
  expect(open).toHaveBeenCalledOnce();
  view.rerender(<StatuslineRow agent="claude" row={row} onModelClick={open} />);
  expect(view.queryByRole("button")).toBeNull();
});

it("groups a separate Codex thinking level with the model before task status", () => {
  const row = splitLines(parseAnsi("gpt-6-astra · \u001b[33mxhigh\u001b[0m · Working · main"))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} onModelClick={vi.fn()} />);
  const button = view.getByRole("button", { name: "Switch model and thinking level: gpt-6-astra xhigh" });
  expect(button).toHaveTextContent("gpt-6-astra xhigh");
  expect(within(button).getByText("xhigh")).toHaveStyle({ color: "var(--ansi-3)" });
  expect(view.getAllByText("xhigh")).toHaveLength(1);
  expect(view.getByRole("img", { name: "Working" })).toBeVisible();
});

it("keeps a custom known model clickable without changing other status fields", () => {
  const row = splitLines(parseAnsi("private-model max · main · Working"))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} knownModels={["private-model"]} onModelClick={vi.fn()} />);
  expect(view.getByRole("button")).toHaveTextContent("private-model max");
  expect(view.getAllByRole("button")).toHaveLength(1);
  expect(view.getByText("main")).toBeVisible();
});

it("preserves the upstream mobile-transparent fill on the OMP statusline", () => {
  const row = splitLines(parseAnsi("\u001b[47mOMP status\u001b[0m"))[0]!;
  row.segments[0]!.mobileTransparentBg = true;
  const { getByText } = render(<StatuslineRow agent="omp" row={row} />);
  const text = getByText("OMP status");
  expect(text).toHaveClass("terminal-mobile-transparent-bg");
  expect(text.style.backgroundColor).toBe("");
  expect(text.style.getPropertyValue("--terminal-seg-bg")).toBe("var(--ansi-7)");
});

it("compacts Hermes statusline to core fields with remaining context and icon-only state", () => {
  const text = " ⚕ example-model │ ~19.5K/1M │ [░░░░░░░░░░] ~2% │ ◎ 65.3% │ ◷ 1.4s │ ↑ 198 t/s │ 1h 32m │ ⏱ 5s │ ✓ 1m       ─ Example conversation ";
  const { container } = renderRow(text, "hermes");
  const ring = container.querySelector('[data-status-icon="context"]');
  expect(ring).toHaveAttribute("data-value", "98");
  expect(ring).toHaveAttribute("data-used", "2");
  expect(within(container).getByRole("img", { name: "Context ~98% left" })).toHaveTextContent("~98%");
  const elapsed = within(container).getByRole("img", { name: "Prompt elapsed 5s" });
  expect(elapsed).toHaveTextContent("");
  expect(elapsed.querySelector("svg")).toHaveClass("lucide-hourglass", "motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]");
  expect(within(container).queryByRole("img", { name: "Idle for 1m" })).toBeNull();
  expect(container.firstElementChild?.firstElementChild).toContainElement(elapsed);
  expect(container.textContent).toBe("example-model~98%");
  expect(container.textContent).not.toMatch(/[░█│]|19\.5K|65\.3%|1\.4s|198|1h 32m|Example conversation/);
  expect(container.querySelector('[data-slot="hermes-statusline"]')).toHaveClass("overflow-x-auto", "whitespace-nowrap");
});

it("keeps unrecognized Hermes fields and drops uninitialized context placeholders", () => {
  const { container } = renderRow(" ⚕ model │ ctx -- │ 上下文 -- │ [░░░░░░░░░░] -- │ 🗜️ 2 │ ⊙ goal 1/4", "hermes");
  expect(container.querySelector('[data-status-icon="context"]')).toBeNull();
  expect(container.textContent).not.toContain("ctx --");
  expect(container.textContent).not.toContain("上下文 --");
  expect(container.textContent).not.toContain("--");
  expect(container.textContent).toContain("🗜️ 2");
  expect(container.textContent).toContain("⊙ goal 1/4");
});

function renderRow(text: string, agent: string | undefined = "codex") {
  const row = splitLines(parseAnsi(text))[0]!;
  const view = render(<StatuslineRow agent={agent} row={row} />);
  return { ...view, row };
}

it("compacts the current Codex statusline without abbreviating model, effort, branch or version", () => {
  const text = "  gpt-6-astra xhigh \u00b7 Working \u00b7 Context 85% left \u00b7 Fast off \u00b7 main \u00b7 0.153.4   ";
  const { container, row } = renderRow(text);
  expect(container.textContent).toBe("gpt-6-astra xhigh85%main0.153.4");
  for (const label of ["Working", "Context 85% left", "Fast off"]) {
    const field = within(container).getByRole("img", { name: label });
    expect(field).toHaveAttribute("title", label);
    expect(field.querySelector('svg, [data-status-icon="context"]')).toHaveClass("size-[12px]");
  }
  expect(lineText(row)).toBe(text);
  const strip = container.querySelector<HTMLElement>('[data-slot="codex-statusline"]')!;
  expect(strip).toHaveClass("gap-1.5", "min-h-3.5", "overflow-x-auto", "whitespace-nowrap");
  expect(strip).not.toHaveClass("truncate");
});

it.each(["1 task", "3 tasks"])("compacts Cursor fields with accessible icons and an animated task count: %s", (tasks) => {
  const text = [
    `\x1b[34m${tasks}\x1b[0m`,
    "\x1b[36mAuto Balance\x1b[0m",
    "\x1b[90msample main\x1b[0m",
    "▓▓▓▓░░ \x1b[36m8\x1b[35m2%\x1b[0m 223k ↑29.3k",
    "\x1b[33mplan 19% (auto 6% api 89%) ↻Sep30\x1b[0m",
  ].join(" · ");
  const { container } = renderRow(text, "cursor");
  const count = tasks.split(" ")[0]!;
  const task = within(container).getByRole("img", { name: tasks });
  expect(task).toHaveTextContent(count);
  expect(task.querySelector("svg")).toHaveClass(
    "lucide-loader-circle",
    "motion-safe:animate-spin",
    "motion-reduce:animate-none",
  );
  expect(task.querySelector("svg")?.style.color).toBe("var(--ansi-4)");
  expect(within(container).getByRole("img", { name: "Auto Balance" }).querySelector("svg"))
    .toHaveClass("lucide-cpu");
  expect(within(container).getByRole("img", { name: "sample main" }).querySelector("svg"))
    .toHaveClass("lucide-folder-git-2");
  expect(within(container).getByRole("img", { name: "Context 82% left" })).toHaveTextContent("82%");
  expect(container.textContent).toContain("223k ↑29.3k");
  expect(within(container).getByRole("img", {
    name: "plan 19% (auto 6% api 89%) ↻Sep30",
  })).toHaveTextContent("19% AUTO:6% API:89%Sep30");
  expect(container.querySelector('[data-slot="cursor-statusline"]')).toHaveClass(
    "overflow-x-auto",
    "whitespace-nowrap",
  );
});

it("keeps Cursor on-demand cost in the compact plan field", () => {
  const text = "plan 23% (auto 8% api 100%) od $1.32/$274 ↻Sep30";
  const { container } = renderRow(`\x1b[33m${text}\x1b[0m`, "cursor");
  const field = within(container).getByRole("img", { name: text });
  expect(field).toHaveTextContent("23% AUTO:8% API:100%$1.32/$274Sep30");
  expect(field.querySelector(".lucide-gauge")).toBeInTheDocument();
  expect(field.querySelector(".lucide-circle-dollar-sign")).toBeInTheDocument();
  expect(field.querySelector(".lucide-calendar-days")).toBeInTheDocument();
});

it("keeps an unrecognized Cursor status field literal and styled", () => {
  const { container } = renderRow("\x1b[35mcustom status field\x1b[0m", "cursor");
  expect(within(container).queryByRole("img")).toBeNull();
  expect(within(container).getByText("custom status field")).toHaveStyle({ color: "var(--ansi-5)" });
});

it("keeps a leading target inside the same horizontally scrollable row", () => {
  const row = splitLines(parseAnsi("model · Working · main"))[0]!;
  const { container } = render(
    <StatuslineRow agent="codex" row={row} leading={<span>workshop</span>} />,
  );
  const strip = container.querySelector<HTMLElement>('[data-slot="codex-statusline"]')!;
  expect(strip.firstElementChild).toHaveAttribute("data-slot", "statusline-target");
  expect(strip.textContent).toContain("workshop");
  expect(strip).toHaveClass("overflow-x-auto", "whitespace-nowrap");
});

it("can render a target-only row when the agent has no status text", () => {
  const { container } = render(
    <StatuslineRow agent="claude" row={{ segments: [] }} leading={<span>workshop</span>} />,
  );
  expect(container.querySelector('[data-slot="statusline-target"]')).toBeInTheDocument();
  expect(container.firstElementChild).toHaveClass("overflow-x-auto", "whitespace-nowrap");
});

it.each([
  ["main", "main", "lucide-git-branch"],
  ["feature/statusline", "feature/statusline", "lucide-git-branch"],
  ["Branch: custom-name", "custom-name", "lucide-git-branch"],
  ["0.154.0", "0.154.0", "lucide-tag"],
  ["v1.8.2+collie.17", "v1.8.2+collie.17", "lucide-tag"],
  ["Ctx 62%", "62%", "lucide-gauge"],
  ["Ready", "", "lucide-circle-check"],
  ["Working", "", "lucide-hourglass"],
  ["Approve for me", "", "lucide-shield-check"],
  ["Approve me", "", "lucide-shield-check"],
  ["Fast on", "", "lucide-zap"],
  ["Fast off", "", "lucide-zap"],
  ["Tasks 2/4", "2/4", "lucide-list-checks"],
  ["Pursuing goal", "", "lucide-target"],
  ["Goal paused (/goal resume)", "", "lucide-pause"],
  ["Goal stalled (/goal resume)", "", "lucide-circle-alert"],
  ["Goal hit usage limits (/goal resume)", "", "lucide-gauge"],
  ["Goal unmet", "", "lucide-circle-off"],
  ["Goal abandoned", "", "lucide-circle-off"],
  ["Goal achieved", "", "lucide-circle-check"],
])("renders %s as a compact, accessible field", (label, value, icon) => {
  const { container } = renderRow(`  model \u00b7 ${label} \u00b7 project-name`);
  const field = within(container).getByRole("img", { name: label });
  expect(field.textContent).toBe(value);
  expect(field).toHaveAttribute("title", label);
  expect(field.querySelector("svg")).toHaveClass(icon);
});

it("matches context across ANSI boundaries and gives the ring and value one capacity color", () => {
  const { container } = renderRow(
    "  \x1b[33mmodel\x1b[0m \u00b7 \x1b[33mCon\x1b[32mtext \x1b[36m73%\x1b[33m left\x1b[0m \u00b7 main",
  );
  const field = within(container).getByRole("img", { name: "Context 73% left" });
  expect(field.style.color).toBe("var(--ansi-10)");
  expect(field.querySelector<HTMLElement>('[data-status-icon="context"]')?.style.color).toBe("");
  expect(within(field).getByText("73%").style.color).toBe("");
  expect(within(container).getByText("model").style.color).toBe("var(--ansi-3)");
});

it.each([
  ["Context 77% left", "77%", 77, 23],
  ["Context 23% used", "77%", 77, 23],
  ["Ctx 77% left", "77%", 77, 23],
  ["Ctx 23% used", "77%", 77, 23],
  ["Context 0% left", "0%", 0, 100],
  ["Context 100% left", "100%", 100, 0],
  ["Context 0% used", "100%", 100, 0],
  ["Context 100% used", "0%", 0, 100],
])("draws the remaining proportion for explicit context unit: %s", (text, visible, percent, used) => {
  const { container, row } = renderRow(text);
  const field = within(container).getByRole("img");
  const ring = field.querySelector<HTMLElement>('[data-status-icon="context"]')!;
  expect(field).toHaveTextContent(visible);
  expect(ring).toHaveAttribute("data-value", String(percent));
  expect(ring).toHaveAttribute("data-used", String(used));
  // jsdom drops these gradients; verify the emitted paint here and rendered pixels in a browser.
  const markup = renderToStaticMarkup(<StatuslineRow agent="codex" row={row} />);
  expect(markup).toContain(`conic-gradient(currentColor ${percent}%`);
  expect(markup).toContain("mask:radial-gradient(farthest-side, transparent calc(100% - 1.5px)");
  expect(lineText(row)).toBe(text);
});

it.each([
  [100, "var(--ansi-10)"],
  [31, "var(--ansi-10)"],
  [30, "rgb(196, 170, 43)"],
  [11, "rgb(196, 170, 43)"],
  [10, "rgb(252, 165, 165)"],
  [0, "rgb(252, 165, 165)"],
])("uses the same capacity color at %s percent remaining in either mode", (left, color) => {
  const { container } = renderRow(`Context ${left}% left \u00b7 Context ${100 - left}% used`);
  for (const field of within(container).getAllByRole("img")) {
    expect(field.style.color).toBe(color);
  }
});

it.each(["Context 101% left", "Context 200% used", "Context -1% left", "Ctx 77%", "Context 77%"])("does not invent context units or progress for %s", (text) => {
  const { container } = renderRow(text);
  expect(container.querySelector('[data-status-icon="context"]')).toBeNull();
  expect(container.textContent).toContain(text.match(/\d+%/)![0]);
});

it("uses one capacity color even when a percentage crosses ANSI spans", () => {
  const { container } = renderRow("Context \x1b[36m7\x1b[35m7%\x1b[0m left");
  expect(within(container).getByText("77%").style.color).toBe("");
  expect(within(container).getByRole("img").style.color).toBe("var(--ansi-10)");
});

it.each([" ", ":"])("uses the same lightning outline for Fast OFF and ON with separator %j", (separator) => {
  const { container, rerender } = renderRow(`\x1b[31mFast${separator}off\x1b[0m`);
  const off = within(container).getByRole("img", { name: `Fast${separator}off` }).querySelector("svg")!;
  const outline = off.innerHTML;
  expect(off).toHaveClass("lucide-zap", "size-[12px]", "shrink-0");
  expect(off).toHaveAttribute("fill", "none");
  expect(off.style.color).toBe("rgb(161, 161, 161)");
  rerender(<StatuslineRow agent="codex" row={splitLines(parseAnsi(`\x1b[31mFast${separator}on\x1b[0m`))[0]!} />);
  const on = within(container).getByRole("img", { name: `Fast${separator}on` }).querySelector("svg")!;
  expect(on).toHaveClass("lucide-zap", "size-[12px]", "shrink-0");
  expect(on).toHaveAttribute("fill", "currentColor");
  expect(on.style.color).toBe("var(--ansi-12)");
  expect(on.innerHTML).toBe(outline);
  expect(container.textContent).toBe("");
});

it.each(["Ready", "Working", "Approve for me", "Tasks 2/4", "Goal:active", "Goal:done"])("keeps Codex's own color for %s", (text) => {
  const { container } = renderRow(`\x1b[35m${text}\x1b[0m`);
  const field = within(container).getByRole("img", { name: text });
  expect(field.querySelector("svg")?.style.color).toBe("var(--ansi-5)");
  for (const span of field.querySelectorAll<HTMLElement>("span[style]")) {
    expect(span.style.color).toBe("var(--ansi-5)");
  }
});

it("keeps plain fields' ANSI spans in one inline flow inside the centered box", () => {
  const { container } = renderRow("\x1b[33mgpt-6-astra \x1b[36mxhigh\x1b[0m");
  const field = container.querySelector('[title="gpt-6-astra xhigh"]')!;
  expect(field.children).toHaveLength(1);
  expect(field.firstElementChild).toHaveTextContent("gpt-6-astra xhigh");
  expect(field.firstElementChild?.children).toHaveLength(2);
});

it.each<[Locale, string]>([
  ["zh", "上下文剩余 77%"],
  ["ja", "コンテキスト残り 77%"],
  ["ko", "컨텍스트 잔여 77%"],
  ["de", "Kontext 77% frei"],
  ["es", "Contexto 77% libre"],
])("keeps context semantics accessible when switching to %s", async (locale, remaining) => {
  const { container } = renderRow("Context 77% left \u00b7 Context 23% used");
  await act(async () => {
    setLocale(locale);
    await whenLocaleReady(locale);
  });
  expect(within(container).getAllByRole("img", { name: remaining })).toHaveLength(2);
  expect(container.textContent).not.toMatch(/余|用|残|使用|잔여|사용|frei|belegt|libre|usado/);
});

it("animates only Working and removes the animation when the state changes", () => {
  const { container, rerender } = renderRow("Working");
  const animation = "motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]";
  expect(container.querySelector("svg")).toHaveClass(animation);
  for (const state of ["Ready", "Approve for me", "Goal paused (/goal resume)"]) {
    rerender(<StatuslineRow agent="codex" row={splitLines(parseAnsi(state))[0]!} />);
    expect(container.querySelector("svg")).not.toHaveClass(animation);
  }
});

it("gives icons, values and plain fields the same centered line box", () => {
  const { container } = renderRow("model \u00b7 Working \u00b7 Context 77% left \u00b7 Tasks 2/4 \u00b7 main");
  const strip = container.querySelector<HTMLElement>('[data-slot="codex-statusline"]')!;
  expect(strip).toHaveClass("items-center", "leading-none", "tabular-nums");
  for (const field of strip.children) expect(field).toHaveClass("min-h-3.5", "items-center");
  expect(within(strip).getByText("77%")).toHaveClass("min-w-[4ch]", "tabular-nums");
});

it("preserves unknown fields, terminal colors and literal text, without matching partial labels", () => {
  const { container } = renderRow(
    '  model \u00b7 \x1b[36mfeature/Working\x1b[0m \u00b7 Context 75% left soon \u00b7 <img src=x> \u00b7 Main [default]',
  );
  expect(within(container).getAllByRole("img")).toHaveLength(1);
  expect(within(container).getByRole("img", { name: "feature/Working" }).querySelector("svg")).toHaveClass("lucide-git-branch");
  expect(within(container).getByText("feature/Working").style.color).toBe("var(--ansi-6)");
  expect(container.textContent).toContain("Context 75% left soon<img src=x>Main [default]");
  expect(container.querySelector("img")).toBeNull();
});

it("leaves project paths, arbitrary names and partial versions undecorated", () => {
  const { container } = renderRow("/repo/main · ~/feature/statusline · project-name · Main [default] · 0.154 · 0.154.0 preview");
  expect(container.querySelector("svg")).toBeNull();
});

it.each(["pi", "opencode", "unknown"])("leaves %s status rows verbatim", (agent) => {
  const text = "  \x1b[36mContext 73% left\x1b[0m \u00b7 Working \u00b7 Fast on   ";
  const { container, row } = renderRow(text, agent);
  expect(container.textContent).toBe(lineText(row));
    expect(container.firstElementChild).toHaveClass("overflow-x-auto", "whitespace-nowrap");
  expect(within(container).queryAllByRole("img")).toHaveLength(0);
  expect(within(container).getByText("Context 73% left").style.color).toBe("var(--ansi-6)");
});

it.each(["agy", "antigravity"])("separates %s hint and model fields across wide and zero-gap 38-column rows", (agent) => {
  const wide = renderRow(
    "\x1b[38;5;8m? for shortcuts                                  \x1b[0m\x1b[2mGemini 4 Argon · medium\x1b[0m",
    agent,
  );
  const wideStrip = wide.container.querySelector('[data-slot="agy-statusline"]')!;
  expect(wideStrip).not.toBeNull();
  expect(wide.container.textContent).not.toMatch(/ {2,}/);
  expect(wideStrip.querySelectorAll("span.w-px")).toHaveLength(0);
  expect(within(wide.container).getByRole("img", { name: "? for shortcuts" }).querySelector("svg")!.style.color).toBe("var(--ansi-8)");
  expect(within(wide.container).getByTitle("Gemini 4 Argon medium").querySelector("span[style]")).toHaveStyle({ opacity: 0.6 });

  const tight = renderRow(
    "\x1b[38;5;8m? for shortcuts\x1b[0m\x1b[2mGemini 4 Argon · medium\x1b[0m",
    agent,
  );
  const tightStrip = tight.container.querySelector('[data-slot="agy-statusline"]')!;
  expect(tightStrip.querySelectorAll("span.w-px")).toHaveLength(0);
  expect(within(tight.container).getByRole("img", { name: "? for shortcuts" })).toBeInTheDocument();
  expect(within(tight.container).getByTitle("Gemini 4 Argon medium")).toHaveTextContent("Gemini 4 Argon medium");
});

it.each(["GEMINI MODELS", "Gemini"])("orders AGY state first and version last while dropping token/cache counters: %s", (group) => {
  const animation = "motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]";
  const view = renderRow(`auto  idle  Gemini 4 Argon (High)  ctx 87%  main  v1.4.4  ${group} 5h 82.7% ↻3h32m · 7d 92.4% ↻5d19h  CLAUDE AND GPT MODELS 5h 100% ↻4h58m · 7d 86% ↻6d17h  Σin 135.4k  out 138.1k  cache 98%  unknown tail`, "agy");
  const autoMode = view.getByRole("img", { name: "auto" });
  expect(autoMode).toHaveTextContent("Auto");
  expect(autoMode.querySelector("svg")).toBeNull();
  const idleIcon = view.getByRole("img", { name: "idle" });
  expect(idleIcon).toHaveTextContent("");
  expect(idleIcon.querySelector("svg")).toHaveClass("lucide-circle-check");
  expect(idleIcon.querySelector("svg")).not.toHaveClass(animation);
  expect(view.getByRole("img", { name: "Context 87% left" })).toBeInTheDocument();
  expect(view.container.querySelectorAll(".lucide-timer, .lucide-calendar-days")).toHaveLength(0);
  expect(view.getByRole("img", { name: "Gemini 5h 82.7% left ↻3h32m" })).toHaveTextContent("5h82.7%");
  expect(view.getByText("Claude/GPT")).toBeInTheDocument();
  expect(view.getByText("unknown tail")).toBeInTheDocument();
  expect(view.container.textContent).toBe(
    "Gemini 4 Argon highAuto87%unknown tailGeminileft5h82.7%7d92.4%5h ↻3h32m · 7d ↻5d19hClaude/GPTleft5h100%7d86%5h ↻4h58m · 7d ↻6d17hmainv1.4.4",
  );
  expect(view.container.textContent).not.toMatch(/MODELS|ctx |135\.4k|138\.1k|98%|\(High\)/);
  expect(view.container.querySelector('[data-slot="agy-statusline"]')).toHaveClass("overflow-x-auto", "whitespace-nowrap");

  for (const active of ["thinking", "working", "tool_use", "initializing", "authenticating", "merging"]) {
    view.rerender(<StatuslineRow agent="agy" row={splitLines(parseAnsi(`Gemini 4 Argon (High)  auto  ${active}  ctx 87%  main  v1.4.4`))[0]!} />);
    const svg = view.getByRole("img", { name: active }).querySelector("svg");
    expect(svg).toHaveClass("lucide-hourglass", animation);
  }
  view.rerender(<StatuslineRow agent="agy" row={splitLines(parseAnsi("Gemini 3.8 Flash (Low)  plan  reviewing  ctx 98%  main  v1.4.7"))[0]!} />);
  expect(view.getByRole("img", { name: "plan" })).toHaveTextContent("Plan");
  expect(view.getByRole("img", { name: "reviewing" }).querySelector("svg")).toHaveClass("lucide-list-checks");
  view.rerender(<StatuslineRow agent="agy" row={splitLines(parseAnsi("Gemini 3.8 Flash (Low)  plan  error  ctx 98%  main  v1.4.7"))[0]!} />);
  expect(view.getByRole("img", { name: "error" }).querySelector("svg")).toHaveClass("lucide-circle-alert");
});

it.each([["auto", "Auto"], ["default", "Ask"], ["accept-edits", "Edit"], ["plan", "Plan"]])("keeps AGY %s mode readable", (mode, label) => {
  const view = renderRow(`Gemini 4 Argon  ${mode}  idle`, "agy");
  expect(view.getByRole("img", { name: mode })).toHaveTextContent(label);
});

it("marks low remaining AGY quota and retains unknown fields", () => {
  const view = renderRow("Gemini 5h 0% ↻now · 7d 19%  future-state  unknown-mode", "agy");
  expect(view.getByText("0%")).toHaveClass("text-status-blocked");
  expect(view.getByText("19%")).toHaveClass("text-status-working");
  expect(view.getByText("future-state")).toBeVisible();
  expect(view.getByText("unknown-mode")).toBeVisible();
});

it.each([
  ["Gemini 4 Argon (High)", "Gemini"],
  ["Claude Opus 5.5 (High)", "Claude/GPT"],
  ["gpt-6-astra (High)", "Claude/GPT"],
  ["Custom Model", "Gemini"],
])("prioritizes the active quota family without guessing unknown models: %s", (model, first) => {
  const view = renderRow(`auto  idle  ${model}  ctx 87%  main  Gemini 5h 82.7% ↻3h32m · 7d 92.4% ↻5d19h  Claude/GPT 5h 100% ↻4h58m · 7d 86% ↻6d17h  v1.4.5`, "agy");
  const strip = view.container.firstElementChild!;
  expect(strip.firstElementChild).toContainElement(view.getByRole("img", { name: "idle" }));
  const windows = view.getAllByRole("img", { name: /^(?:Gemini|Claude\/GPT) (?:5h|7d)/ });
  expect(windows).toHaveLength(4);
  expect(windows[0]).toHaveAccessibleName(new RegExp(`^${first} 5h`));
  expect(view.getAllByText("left", { exact: true })).toHaveLength(2);
  expect(strip.querySelectorAll('[data-slot="statusline-divider"]')).toHaveLength(2);
  expect(strip.textContent?.endsWith("mainv1.4.5")).toBe(true);
  const group = windows[0]!.parentElement!;
  expect(group.textContent?.indexOf("7d")).toBeLessThan(group.textContent!.indexOf("↻"));
});

it("keeps measured quota percentages when the native capture clips the final reset", () => {
  const text = readFileSync(join(import.meta.dirname, "..", "fixtures", "panes", "agy--v145-status-interrupted--w120.txt"), "utf8");
  const row = splitLines(parseAnsi(text)).at(-1)!;
  const view = render(<StatuslineRow agent="agy" row={row} />);
  expect(view.getByRole("img", { name: "idle" })).toBeVisible();
  expect(view.getByRole("img", { name: "Claude/GPT 7d 86% left ↻" })).toBeVisible();
});

it("compacts the captured Claude custom statusline without printing its right-side hint", () => {
  const capture = readFileSync(join(import.meta.dirname, "..", "fixtures", "panes", "claude--custom-statusline.txt"), "utf8");
  const rows = extractStatusLines(splitLines(parseAnsi(capture)));
  expect(rows).toHaveLength(2);
  const view = render(<StatuslineRow agent="claude" row={rows[0]!} leading={<span>workshop</span>} />);
  const ring = view.container.querySelector('[data-status-icon="context"]')!;
  expect(ring).toHaveAttribute("data-value", "34");
  expect(ring).toHaveAttribute("data-used", "66");
  expect(view.getByRole("img")).toHaveAttribute("aria-label", "Context 34% left");
  expect(view.container.textContent).toContain("example-model[1m] xhigh");
  // The `new task? /clear to save 600.0k tokens` field is DROPPED, not decorated: it is the agent's
  // TIP, and the belt's pill (composer.tsx) carries it. claudeHintText (chrome.test.ts) is what feeds
  // that pill; this test is the other half, that the strip never prints it a second time.
  expect(view.container.textContent).not.toContain("new task?");
  expect(claudeHintText(rows)).toBe("new task? /clear to save 600.0k tokens");
  expect(view.container.textContent).not.toMatch(/ {2,}|\|/);
  expect(view.container.querySelector(".lucide-git-branch")).not.toBeNull();
  expect(view.container.querySelector(".lucide-tag")).not.toBeNull();
  const strip = view.container.querySelector('[data-slot="claude-statusline"]')!;
  expect(strip).toHaveClass("overflow-x-auto", "whitespace-nowrap");
  expect(strip.firstElementChild).toHaveAttribute("data-slot", "statusline-target");
  expect(view.getByText("example-model[1m] xhigh")).toHaveStyle({ color: "rgb(153,153,153)" });
});

it("drops a notification row instead of printing it in the strip", () => {
  // 2.1.278's notifications are painted right-aligned on their OWN row below the mode row, so the row
  // arrives carrying the terminal's alignment padding. It used to fall to the verbatim branch and print
  // as raw, deeply indented strip text; it is the agent's TIP now, carried by the actions belt's
  // lightbulb pill (composer.tsx, fed by claudeHintText), so the strip draws nothing for it.
  for (const apart of ["new task? /clear to save 681.5k tokens", "Ctrl+Y to paste deleted text"]) {
    const row = splitLines(parseAnsi(`${" ".repeat(47)}${apart}`))[0]!;
    const view = render(<StatuslineRow agent="claude" row={row} />);
    expect(view.container.textContent).toBe("");
  }
});

it.each(["on", "off"])("shows explicit Claude Fast:%s without adding a mode switch", (state) => {
  const row = splitLines(parseAnsi(`model | Fast:${state} | ctx 30%`))[0]!;
  const view = render(<StatuslineRow agent="claude" row={row} />);
  expect(view.getByRole("img", { name: `Fast:${state}` }).querySelector("svg")).toHaveAttribute("fill", state === "on" ? "currentColor" : "none");
  expect(view.queryAllByRole("button")).toHaveLength(0);
});

it.each([
  ["cache warm 85%", "Warm · Cache hit 85%", "Warm 85%"],
  ["cache cold 0%", "Cold · Cache hit 0%", "Cold 0%"],
  ["cache warm", "Warm", "Warm"],
  ["cache unreported", "Unreported", "Unreported"],
])("shows native Claude %s without inventing missing hit ratios", (field, label, text) => {
  const row = splitLines(parseAnsi(`model | ${field} | main`))[0]!;
  const view = render(<StatuslineRow agent="claude" row={row} />);
  expect(view.getByRole("img", { name: label })).toHaveTextContent(text);
});

it.each([0, 7, 30, 100])("treats Claude ctx %s%% as remaining across ANSI spans", (remaining) => {
  const row = splitLines(parseAnsi(`model | ctx \x1b[36m${remaining}\x1b[0m% | main`))[0]!;
  const view = render(<StatuslineRow agent="claude" row={row} />);
  expect(view.container.querySelector('[data-status-icon="context"]')).toHaveAttribute("data-used", String(100 - remaining));
  view.rerender(<StatuslineRow agent="codex" row={row} />);
  expect(view.container.querySelector('[data-status-icon="context"]')).toBeNull();
  view.rerender(<StatuslineRow agent="hermes" row={row} />);
  expect(view.container.querySelector('[data-status-icon="context"]')).toBeNull();
});

it.each(["ctx --", "ctx -1%", "ctx 101%", "cache 75%", "Fast"])("keeps untyped or invalid Claude field %s literal", (field) => {
  const row = splitLines(parseAnsi(`model | ${field} | custom-branch`))[0]!;
  const view = render(<StatuslineRow agent="claude" row={row} />);
  expect(view.container.querySelector('[data-status-icon="context"]')).toBeNull();
  expect(view.container.textContent).toContain(field);
  expect(view.container.textContent).toContain("custom-branch");
});

it("leaves a claude status row verbatim when no mode control is wired", () => {
  const text = "  \x1b[36mContext 73% left\x1b[0m \u00b7 Working";
  const { container, row } = renderRow(text, "claude");
  expect(container.textContent).toBe(lineText(row));
  expect(within(container).queryAllByRole("button")).toHaveLength(0);
});

it("renders the claude mode field as a tappable control and replaces the hint with the two keys", () => {
  // The capture paints the mode pink and the hint grey; only the mode stays, in its own colour.
  const row = splitLines(parseAnsi(
    "  \x1b[38;2;255;107;128m\u23f5\u23f5 bypass permissions on\x1b[0m\x1b[38;2;153;153;153m (shift+tab to cycle) \u00b7 \u2190 1 agent\x1b[0m",
  ))[0]!;
  const onClick = vi.fn();
  const { container } = render(<StatuslineRow agent="claude" row={row} claudeMode={{ busy: false, onClick }} />);
  const button = within(container).getByRole("button", { name: "Claude mode: \u23f5\u23f5 bypass permissions on, tap to cycle" });
  expect(button).toBeEnabled();
  expect(container.textContent).not.toContain("shift+tab");
  expect(container.textContent).toContain("\u2190 1 agent");
  expect(container.textContent?.startsWith("\u23f5\u23f5")).toBe(true);
  // The two keys the hint named, as text glyphs in the row's own font, wrapped in parentheses.
  expect(button.textContent).toContain("\u23f5\u23f5 bypass permissions on");
  expect(within(button).queryAllByText("Shift")).toHaveLength(0);
  expect(button.textContent).toContain("(\u21e7\u21e5)");
  expect(button.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(0);
  expect(container.textContent).toContain("\u23f5\u23f5 bypass permissions on"); // own colour survives
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it("greys the claude mode control while a reason stands and shows the spinner while busy", () => {
  const row = splitLines(parseAnsi("  \u23f8 manual mode on"))[0]!;
  const { rerender } = render(
    <StatuslineRow agent="claude" row={row} claudeMode={{ busy: false, disabledReason: "read-only", onClick: vi.fn() }} />,
  );
  expect(within(document.body).getByRole("button", { name: /Claude mode/ })).toBeDisabled();

  rerender(<StatuslineRow agent="claude" row={row} claudeMode={{ busy: true, onClick: vi.fn() }} />);
  expect(within(document.body).getByRole("button", { name: /Claude mode/ })).toBeEnabled();
});

it("leaves a claude mode row without a wired control verbatim", () => {
  const text = "  \x1b[38;2;153;153;153m\u23f8 manual mode on \u00b7 \u2190 4 agents\x1b[0m";
  const { container, row } = renderRow(text, "claude");
  expect(container.textContent).toBe(lineText(row));
  expect(within(container).queryAllByRole("button")).toHaveLength(0);
});

it.each(["⚕", "☤"])("expands a matched Hermes %s model without showing its saved reasoning effort", (glyph) => {
  const model = "provider/example-model-with-a-very-long-name";
  const terminalName = "example-model-with-a-very-long-name".slice(0, 23) + "...";
  const row = splitLines(parseAnsi(`${glyph} \x1b[33m${terminalName}\x1b[0m │ [░░░░░░░░░░] ~2% │ ◷ 1.4s`))[0]!;
  const { container, rerender } = render(<StatuslineRow agent="hermes" row={row} sessionModel={{ model, reasoningEffort: "high" }} />);
  const modelField = within(container).getByText(model, { exact: true });
  expect(modelField.style.color).toBe("var(--ansi-3)");
  expect(modelField).toHaveAttribute("title", model);
  expect(container.textContent).not.toContain("high");
  expect(container.textContent).not.toContain("...");
  expect(container.textContent).toContain("~98%");
  expect(container.textContent).not.toContain("1.4s");
  rerender(<StatuslineRow agent="hermes" row={row} sessionModel={{ model }} />);
  expect(within(container).getByText(model, { exact: true })).toBeInTheDocument();
  rerender(<StatuslineRow agent="hermes" row={row} sessionModel={{ model: "different-model", reasoningEffort: "high" }} />);
  expect(container.textContent).toContain(terminalName);
  expect(container.textContent).not.toContain("high");
});

it("marks a switchable model field with a reserved arrow slot", () => {
  const row = splitLines(parseAnsi("gpt-6-astra xhigh · Context 85% left · main"))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} modelSwitchable onModelClick={vi.fn()} />);
  const button = view.getByRole("button");

  // One target, not two: the arrow lives INSIDE the model's own button, so it adds no second
  // control to the tab order and the field stays a single tap.
  expect(view.getAllByRole("button")).toHaveLength(1);
  const arrow = button.querySelector("svg[aria-hidden='true']")!;
  expect(arrow).toHaveClass("opacity-100");

  view.rerender(<StatuslineRow agent="codex" row={row} onModelClick={vi.fn()} />);
  // The slot is still OCCUPIED with nothing to switch to — the fields after it may not shift.
  expect(view.getByRole("button").querySelector("svg[aria-hidden='true']")).toHaveClass("opacity-40");
  expect(view.getByRole("button")).toHaveTextContent("gpt-6-astra xhigh");
});

it("orders Codex mode controls after the model and filters native mode fields", () => {
  const row = splitLines(parseAnsi("main · Fast on · gpt-6-astra · xhigh · Plan mode (Shift+Tab to cycle) · Context 85% left"))[0]!;
  const view = render(
    <StatuslineRow
      agent="codex"
      row={row}
      onModelClick={vi.fn()}
      modelSwitchable
      codexControls={{
        plan: { enabled: false, busy: false, onClick: vi.fn() },
        fast: { enabled: true, busy: false, onClick: vi.fn() },
      }}
    />,
  );

  const strip = view.container.querySelector<HTMLElement>('[data-slot="codex-statusline"]')!;
  const controls = [...strip.querySelectorAll<HTMLElement>('[data-slot="codex-mode-toggle"]')];
  expect(controls.map((control) => control.dataset.mode)).toEqual(["plan", "fast"]);
  expect(strip.textContent).toContain("gpt-6-astra xhigh");
  expect(strip.textContent).toContain("PlanFast");
  expect(strip.textContent).not.toContain("Fast on");
  expect(strip.textContent).not.toContain("Plan mode");
  expect(strip.querySelectorAll(".bg-white\\/25")).toHaveLength(1);
  expect(strip).toHaveClass("overflow-x-auto", "whitespace-nowrap");
  expect([...strip.children].some((child) => child.className.includes("overflow-x-auto"))).toBe(false);
});

it.each(["⚠ 1 warning", "⚠ 3 warnings"])("renders %s as one accessible warning button", (warning) => {
  const open = vi.fn();
  const row = splitLines(parseAnsi(
    `  gpt-6-astra · Context 85% left · main · 0.156.1${" ".repeat(32)}${warning} · f2 to view · other (shift+tab to cycle)`,
  ))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} codexControls={{
    plan: { enabled: false, busy: false, onClick: vi.fn() },
    fast: { enabled: false, busy: false, onClick: vi.fn() },
  }} codexWarning={{ onClick: open }} />);
  const button = view.getByRole("button", { name: `${warning} · f2 to view` });
  expect(button).toHaveAttribute("title", `${warning} · f2 to view`);
  expect(button).toHaveClass("text-amber-400");
  expect(button).toHaveTextContent(Number(warning.match(/\d+/)![0]).toString());
  expect(button.querySelector("svg")).toHaveClass("lucide-triangle-alert");
  expect(view.container.textContent).toContain("0.156.1");
  expect(view.container.textContent?.endsWith("0.156.1")).toBe(true);
  expect(view.container.textContent).toContain("other (shift+tab to cycle)");
  expect(view.container.textContent).not.toContain("f2 to view");
  fireEvent.click(button);
  expect(open).toHaveBeenCalledExactlyOnceWith(Number(warning.match(/\d+/)![0]));
});

it("removes only the native Plan hint when its cycle text has separate ANSI paint", () => {
  const row = splitLines(parseAnsi(
    "  gpt-6-astra · Context 85% left · \x1b[35mPlan mode\x1b[0m\x1b[2m (shift+tab to cycle)\x1b[0m · other Shift+Tab hint",
  ))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} codexControls={{
    plan: { enabled: true, busy: false, onClick: vi.fn() },
    fast: { enabled: false, busy: false, onClick: vi.fn() },
  }} />);
  expect(view.container.textContent).not.toContain("(shift+tab to cycle)");
  expect(view.container.textContent).toContain("other Shift+Tab hint");
});

it.each(["", "⚠ 2 warnings · f2 details", "⚠ 2 warnings · f2 to view later"])(
  "keeps unrecognized warning tail %s as text", (tail) => {
    const row = splitLines(parseAnsi(`gpt-6-astra · Context 85% left${tail ? ` · ${tail}` : ""}`))[0]!;
    const view = render(<StatuslineRow agent="codex" row={row} codexControls={{
      plan: { enabled: false, busy: false, onClick: vi.fn() },
      fast: { enabled: false, busy: false, onClick: vi.fn() },
    }} codexWarning={{ onClick: vi.fn() }} />);
    expect(view.queryByRole("button", { name: /warning/ })).toBeNull();
    if (tail) {
      expect(view.container.textContent).toContain("⚠ 2 warnings");
      expect(view.container.textContent).toContain(tail.split(" · ")[1]);
    }
  },
);

it("renders Plan and Fast controls even when the Codex row is empty", () => {
  const view = render(
    <StatuslineRow
      agent="codex"
      row={{ segments: [] }}
      codexControls={{
        plan: { enabled: null, busy: false, onClick: vi.fn() },
        fast: { enabled: false, busy: false, onClick: vi.fn() },
      }}
    />,
  );

  expect(view.container.querySelectorAll('[data-slot="codex-mode-toggle"]')).toHaveLength(2);
  expect(view.getByRole("button", { name: "Plan mode: UNKNOWN" })).toBeDisabled();
  expect(view.getByRole("button", { name: "Fast mode: OFF" })).not.toBeDisabled();
});

it("does not consume task status when thinking level is already inside the model field", () => {
  const row = splitLines(parseAnsi("gpt-6-astra xhigh · Working · Fast off · Context 70% left"))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} onModelClick={vi.fn()} codexControls={{
    plan: { enabled: false, busy: false, onClick: vi.fn() },
    fast: { enabled: false, busy: false, onClick: vi.fn() },
  }} />);
  expect(view.getByRole("button", { name: "Switch model and thinking level: gpt-6-astra xhigh" })).not.toHaveTextContent("Working");
  expect(view.getByRole("img", { name: "Working" })).toBeVisible();
  expect(view.getByRole("img", { name: "Context 70% left" })).toBeVisible();
});

it.each([
  ["Claude Opus 5.5 (High)", "Claude Opus 5.5 high"],
  ["Gemini 4 Argon (XHigh)", "Gemini 4 Argon xhigh"],
  ["Gemini 4 Argon · medium", "Gemini 4 Argon medium"],
  ["Custom Model (Preview)", "Custom Model (Preview)"],
])("prints the AGY thinking level like Codex and Claude: %s", (model, shown) => {
  const view = renderRow(`\x1b[2m${model}\x1b[0m  auto  idle`, "agy");
  expect(view.container.textContent?.startsWith(`${shown}Auto`)).toBe(true);
  if (shown !== model) expect(view.getByTitle(shown).querySelector("span[style]")).toHaveStyle({ opacity: 0.6 });
});

it.each([
  ["weekly 91% left", "7d 91% left", "91%", "text-status-idle"],
  ["5h 85% used", "5h 15% left", "15%", "text-status-working"],
  ["5h 100% used", "5h 0% left", "0%", "text-status-blocked"],
  ["5h 0% used", "5h 100% left", "100%", "text-status-idle"],
  ["weekly 9% left", "7d 9% left", "9%", "text-status-blocked"],
])("renders the Codex quota %s with the shared quota field", (field, name, percent, tone) => {
  const view = renderRow(`model · ${field} · main`);
  const quota = view.getByRole("img", { name });
  expect(quota.querySelector("svg")).toBeNull();
  expect(within(quota).getByText(percent, { exact: false })).toHaveClass(tone);
  expect(view.getByTitle(field, { exact: true })).toBeInTheDocument();
});

it("reads the modern Hermes row in the shared order and drops redundant fields and key hints", () => {
  const text = " ☤ deepseek-flash · TP 9.5% · ↻11-21 00:00 · 158K/1M pinned · [██░░░░░░░░] 16% · ⎇ main · ◎ 97.2% · ◷ 1.2s · ↑ 7 t/s · 14h 1m · ⏲ 2s · ✓ 13h 59m · ~/.hermes                    / commands · @ files · ! shell";
  const { container } = renderRow(text, "hermes");
  const strip = container.querySelector('[data-slot="hermes-statusline"]')!;
  expect(strip.querySelectorAll("span.w-px")).toHaveLength(2);
  expect(container.textContent).not.toMatch(/commands|files|shell|·|158K|97\.2%|1\.2s|7 t\/s|14h|2s|13h|\.hermes/);
  const idle = within(container).getByRole("img", { name: "Idle for 13h 59m" });
  expect(idle).toHaveTextContent("");
  expect(idle.querySelector("svg")).toHaveClass("lucide-circle-check");
  expect(within(container).queryByRole("img", { name: /Prompt elapsed/ })).toBeNull();
  expect(within(container).getByRole("img", { name: "Context 84% left" })).toHaveTextContent("84%");
  expect(within(container).getByRole("img", { name: "main" }).querySelector("svg")).toHaveClass("lucide-git-branch");
  const quota = within(container).getByRole("img", { name: "TP 9.5% left ↻11-21 00:00" });
  expect(within(quota).getByText("9.5%", { exact: false })).toHaveClass("text-status-blocked");
  expect(container.textContent).toBe("deepseek-flash84%TPleft9.5%↻11-21 00:00main");
});

it.each([false, true])("groups Codex windows behind one remaining unit with controls=%s", (controlled) => {
  const row = splitLines(parseAnsi("gpt-6-astra xhigh · Ready · main · 5h 85% used · weekly 9% left · v0.163.0"))[0]!;
  const view = render(<StatuslineRow agent="codex" row={row} codexControls={controlled ? {
    plan: { enabled: false, busy: false, onClick: vi.fn() },
    fast: { enabled: false, busy: false, onClick: vi.fn() },
  } : undefined} />);
  const strip = view.container.firstElementChild!;
  expect(strip.firstElementChild).toContainElement(view.getByRole("img", { name: "Ready" }));
  expect(view.getAllByText("left", { exact: true })).toHaveLength(1);
  expect(view.getByRole("img", { name: "5h 15% left" })).toHaveTextContent("5h15%");
  expect(view.getByRole("img", { name: "7d 9% left" })).toHaveTextContent("7d9%");
  expect(strip.querySelectorAll('[data-slot="statusline-divider"]')).toHaveLength(2);
  expect(strip.textContent?.endsWith("mainv0.163.0")).toBe(true);
});

it.each(["5h 91%", "5h 101% used"])("keeps a remaining unit after an ambiguous or invalid quota: %s", (field) => {
  const view = renderRow(`model · ${field} · weekly 9% left`);
  expect(view.getByText("left", { exact: true })).toBeVisible();
  expect(view.getByRole("img", { name: "7d 9% left" })).toBeVisible();
});

it("divides functional groups in classic Hermes and uncontrolled Codex rows", () => {
  const hermes = renderRow(" ⚕ model │ ~19.5K/1M │ [░░░░░░░░░░] ~2% │ ◎ 65.3%", "hermes");
  expect(hermes.container.querySelectorAll("span.w-px")).toHaveLength(0);
  expect(hermes.container.textContent).toBe("model~98%");
  const codex = render(<StatuslineRow agent="codex" row={splitLines(parseAnsi("gpt-6-astra · xhigh · Ready · main"))[0]!} onModelClick={vi.fn()} />);
  expect(codex.container.querySelectorAll("span.w-px")).toHaveLength(1);
  expect(codex.getByRole("button", { name: /gpt-6-astra xhigh/ })).toBeInTheDocument();
});

it("places version fields at the end of Claude and Codex statuslines", () => {
  const claude = renderRow("model | v2.1.278 | ctx 34% | main", "claude");
  expect(claude.container.textContent).toBe("model34%mainv2.1.278");

  const codexRow = splitLines(parseAnsi("gpt-6-astra xhigh · v0.121.0 · Context 85% left · main"))[0]!;
  const uncontrolled = render(<StatuslineRow agent="codex" row={codexRow} lastTurnFirstTokenMs={1200} />);
  expect(uncontrolled.container.textContent).toBe("gpt-6-astra xhigh85%main1.2sv0.121.0");

  const controlled = render(
    <StatuslineRow
      agent="codex"
      row={codexRow}
      lastTurnFirstTokenMs={1200}
      codexControls={{
        plan: { enabled: false, busy: false, onClick: vi.fn() },
        fast: { enabled: false, busy: false, onClick: vi.fn() },
      }}
    />,
  );
  expect(controlled.container.textContent).toBe("gpt-6-astra xhighPlanFast85%main1.2sv0.121.0");
});


it("fills missing usage fields with compact remaining values and preserves native readings", () => {
  const usage: import("@/lib/types").PaneUsage = { context: 65, limits: [{ window: "5h", used: 80 }, { window: "7d", used: 40 }] };
  const { rerender, container, getByRole } = render(<UsageFields usage={usage} rows={[]} />);
  expect(getByRole("img", { name: "Context 35% left" })).toHaveTextContent("35%");
  expect(getByRole("img", { name: "5h 20% left" })).toHaveTextContent("20%");
  expect(getByRole("img", { name: "7d 60% left" })).toHaveTextContent("60%");
  const rows = splitLines(parseAnsi("Ctx 10% left · 5h 42% left · weekly 21% left"));
  rerender(<UsageFields usage={usage} rows={rows} />);
  expect(container).toBeEmptyDOMElement();
});

it.each(["ctx 78%", "[████░] ~22%", "▓▓░░ 30%"])("does not duplicate native context: %s", (text) => {
  const { container } = render(<UsageFields usage={{ context: 22 }} rows={splitLines(parseAnsi(text))} />);
  expect(container).toBeEmptyDOMElement();
});
