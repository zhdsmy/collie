import { act, fireEvent, render, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { __resetLocale, setLocale, whenLocaleReady, type Locale } from "@/lib/i18n";
import { StatuslineRow } from "./statusline-row";

beforeEach(() => __resetLocale());

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

it.each(["claude", "pi", "opencode", "unknown"])("leaves %s status rows verbatim", (agent) => {
  const text = "  \x1b[36mContext 73% left\x1b[0m \u00b7 Working \u00b7 Fast on   ";
  const { container, row } = renderRow(text, agent);
  expect(container.textContent).toBe(lineText(row));
    expect(container.firstElementChild).toHaveClass("overflow-x-auto", "whitespace-nowrap");
  expect(within(container).queryAllByRole("img")).toHaveLength(0);
  expect(within(container).getByText("Context 73% left").style.color).toBe("var(--ansi-6)");
});

it("shows a matched Hermes session's full model and saved effort without truncation", () => {
  const model = "provider/example-model-with-a-very-long-name";
  const terminalName = "example-model-with-a-very-long-name".slice(0, 23) + "...";
  const row = splitLines(parseAnsi(`⚕ \x1b[33m${terminalName}\x1b[0m │ [░░░░░░░░░░] ~2% │ ◷ 1.4s`))[0]!;
  const { container, rerender } = render(<StatuslineRow agent="hermes" row={row} sessionModel={{ model, reasoningEffort: "high" }} />);
  expect(within(container).getByText(`${model} high`).style.color).toBe("var(--ansi-3)");
  expect(container.textContent).not.toContain("...");
  expect(container.textContent).toContain("~2%");
  expect(container.textContent).toContain("1.4s");
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
  expect(strip.querySelectorAll(".bg-white\\/25")).toHaveLength(4);
  expect(strip).toHaveClass("overflow-x-auto", "whitespace-nowrap");
  expect([...strip.children].some((child) => child.className.includes("overflow-x-auto"))).toBe(false);
});

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
