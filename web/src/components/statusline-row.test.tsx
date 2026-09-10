import { act, render, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { __resetLocale, setLocale, whenLocaleReady, type Locale } from "@/lib/i18n";
import { StatuslineRow } from "./statusline-row";

beforeEach(() => __resetLocale());

it("compacts Hermes metrics without confusing cache hit with context used", () => {
  const text = " ⚕ example-model │ ~19.5K/1M │ [░░░░░░░░░░] ~2% │ ◎ 65.3% │ ◷ 1.4s │ ↑ 198 t/s │ 1h 32m │ ⏱ 5s │ ✓ 1m       ─ Example conversation ";
  const { container } = renderRow(text, "hermes");
  const ring = container.querySelector('[data-status-icon="context"]');
  expect(ring).toHaveAttribute("data-used", "2");
  expect(within(container).getByRole("img", { name: "Cache hit 65.3%" })).toHaveTextContent("65.3%");
  expect(within(container).getByRole("img", { name: "Generation speed 198 t/s" })).toHaveTextContent("198 t/s");
  expect(within(container).getByRole("img", { name: "Prompt elapsed 5s" }).querySelector("svg")).toHaveClass("motion-safe:animate-[statusline-hourglass_4.8s_ease-in-out_infinite]");
  expect(container.textContent).not.toMatch(/[░█│]/);
  expect(container.textContent).toContain("Example conversation");
  expect(container.querySelector('[data-slot="hermes-statusline"]')).toHaveClass("overflow-x-auto", "whitespace-nowrap");
});

it("keeps unrecognized Hermes fields and does not turn missing context into zero", () => {
  const { container } = renderRow(" ⚕ model │ ctx -- │ [░░░░░░░░░░] -- │ 🗜️ 2 │ ⊙ goal 1/4", "hermes");
  expect(container.querySelector('[data-status-icon="context"]')).toBeNull();
  expect(container.textContent).toContain("ctx --");
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
  ["Ctx 62%", "62%", "lucide-gauge"],
  ["Ready", "", "lucide-circle-check"],
  ["Working", "", "lucide-hourglass"],
  ["Approve for me", "", "lucide-shield-check"],
  ["Approve me", "", "lucide-shield-check"],
  ["Fast on", "", "lucide-zap"],
  ["Fast off", "", "lucide-zap"],
  ["Tasks 2/4", "2/4", "lucide-list-checks"],
  ["weekly 91% left", "91%", "lucide-calendar-days"],
  ["5h 9% used", "9% used", "lucide-timer"],
  ["Pursuing goal", "", "lucide-target"],
  ["Goal paused (/goal resume)", "", "lucide-pause"],
  ["Goal stalled (/goal resume)", "", "lucide-circle-alert"],
  ["Goal hit usage limits (/goal resume)", "", "lucide-gauge"],
  ["Goal unmet", "", "lucide-circle-off"],
  ["Goal abandoned", "", "lucide-circle-off"],
  ["Goal achieved", "", "lucide-circle-check"],
])("renders %s as a compact, accessible field", (label, value, icon) => {
  const { container } = renderRow(`  model \u00b7 ${label} \u00b7 main`);
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
  ["Context 23% used", "23%", 23, 23],
  ["Ctx 77% left", "77%", 77, 23],
  ["Ctx 23% used", "23%", 23, 23],
  ["Context 0% left", "0%", 0, 100],
  ["Context 100% left", "100%", 100, 0],
  ["Context 0% used", "0%", 0, 0],
  ["Context 100% used", "100%", 100, 100],
])("draws the displayed proportion with an explicit unit: %s", (text, visible, percent, used) => {
  const { container, row } = renderRow(text);
  const field = within(container).getByRole("img");
  const ring = field.querySelector<HTMLElement>('[data-status-icon="context"]')!;
  expect(field).toHaveTextContent(visible);
  expect(ring).toHaveAttribute("data-value", String(percent));
  expect(ring).toHaveAttribute("data-used", String(used));
  // jsdom drops these gradients; verify the emitted paint here and rendered pixels in a browser.
  const markup = renderToStaticMarkup(<StatuslineRow agent="codex" row={row} />);
  expect(markup).toContain(`conic-gradient(currentColor ${used}%`);
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

it.each(["Ready", "Working", "Approve for me", "Tasks 2/4", "weekly 91% left", "5h 9% used", "Goal:active", "Goal:done"])("keeps Codex's own color for %s", (text) => {
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

it.each<[Locale, string, string]>([
  ["zh", "上下文剩余 77%", "上下文已用 23%"],
  ["ja", "コンテキスト残り 77%", "コンテキスト使用済み 23%"],
  ["ko", "컨텍스트 잔여 77%", "컨텍스트 사용 23%"],
  ["de", "Kontext 77% frei", "Kontext 23% belegt"],
  ["es", "Contexto 77% libre", "Contexto 23% usado"],
])("keeps context semantics accessible when switching to %s", async (locale, remaining, used) => {
  const { container } = renderRow("Context 77% left \u00b7 Context 23% used");
  await act(async () => {
    setLocale(locale);
    await whenLocaleReady(locale);
  });
  expect(within(container).getByRole("img", { name: remaining })).toBeInTheDocument();
  expect(within(container).getByRole("img", { name: used })).toBeInTheDocument();
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
  expect(within(container).queryAllByRole("img")).toHaveLength(0);
  expect(within(container).getByText("feature/Working").style.color).toBe("var(--ansi-6)");
  expect(container.textContent).toContain("Context 75% left soon<img src=x>Main [default]");
  expect(container.querySelector("img")).toBeNull();
});

it.each(["claude", "pi", "opencode", "unknown"])("leaves %s status rows verbatim", (agent) => {
  const text = "  \x1b[36mContext 73% left\x1b[0m \u00b7 Working \u00b7 Fast on   ";
  const { container, row } = renderRow(text, agent);
  expect(container.textContent).toBe(lineText(row));
    expect(container.firstElementChild).toHaveClass("overflow-x-auto", "whitespace-nowrap");
  expect(within(container).queryAllByRole("img")).toHaveLength(0);
  expect(within(container).getByText("Context 73% left").style.color).toBe("var(--ansi-6)");
});
