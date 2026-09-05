import { act, render, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { __resetLocale, setLocale, whenLocaleReady, type Locale } from "@/lib/i18n";
import { StatuslineRow } from "./statusline-row";

beforeEach(() => __resetLocale());

function renderRow(text: string, agent: string | undefined = "codex") {
  const row = splitLines(parseAnsi(text))[0]!;
  const view = render(<StatuslineRow agent={agent} row={row} />);
  return { ...view, row };
}

it("compacts the current Codex statusline without abbreviating model, effort, branch or version", () => {
  const text = "  gpt-6-astra xhigh \u00b7 Working \u00b7 Context 85% left \u00b7 Fast off \u00b7 main \u00b7 0.153.4   ";
  const { container, row } = renderRow(text);
  expect(container.textContent).toBe("gpt-6-astra xhigh85%leftmain0.153.4");
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

it.each([
  ["Ctx 62%", "62%", "lucide-gauge"],
  ["Ready", "", "lucide-circle-check"],
  ["Working", "", "lucide-hourglass"],
  ["Approve for me", "", "lucide-shield-check"],
  ["Approve me", "", "lucide-shield-check"],
  ["Fast on", "", "lucide-zap"],
  ["Fast off", "", "lucide-zap-off"],
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

it("matches fields across ANSI boundaries and retains the value's own paint", () => {
  const { container } = renderRow(
    "  \x1b[33mmodel\x1b[0m \u00b7 \x1b[33mCon\x1b[32mtext \x1b[36m73%\x1b[33m left\x1b[0m \u00b7 main",
  );
  const field = within(container).getByRole("img", { name: "Context 73% left" });
  expect(field.querySelector<HTMLElement>('[data-status-icon="context"]')?.style.color).toBe("rgb(250, 250, 250)");
  expect(within(field).getByText("73%").style.color).toBe("var(--ansi-6)");
});

it.each([
  ["Context 77% left", "77%left", 77, 23],
  ["Context 23% used", "23%used", 23, 23],
  ["Ctx 77% left", "77%left", 77, 23],
  ["Ctx 23% used", "23%used", 23, 23],
  ["Context 0% left", "0%left", 0, 100],
  ["Context 100% left", "100%left", 100, 0],
  ["Context 0% used", "0%used", 0, 0],
  ["Context 100% used", "100%used", 100, 100],
])("draws the displayed proportion with an explicit unit: %s", (text, visible, percent, used) => {
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
  [79, "rgb(250, 250, 250)"],
  [80, "var(--ansi-11)"],
  [94, "var(--ansi-11)"],
  [95, "var(--ansi-9)"],
])("uses the same warning color at %s percent used in either mode", (used, color) => {
  const { container } = renderRow(`Context ${100 - used}% left \u00b7 Context ${used}% used`);
  for (const ring of container.querySelectorAll<HTMLElement>('[data-status-icon="context"]')) {
    expect(ring.style.color).toBe(color);
  }
});

it.each(["Context 101% left", "Context 200% used", "Context -1% left", "Ctx 77%", "Context 77%"])("does not invent context units or progress for %s", (text) => {
  const { container } = renderRow(text);
  expect(container.querySelector('[data-status-icon="context"]')).toBeNull();
  expect(container.textContent).toContain(text.match(/\d+%/)![0]);
});

it("preserves colors even when a percentage itself crosses ANSI spans", () => {
  const { container } = renderRow("Context \x1b[36m7\x1b[35m7%\x1b[0m left");
  expect(within(container).getByText("7").style.color).toBe("var(--ansi-6)");
  expect(within(container).getByText("7%").style.color).toBe("var(--ansi-5)");
});

it("keeps plain fields' ANSI spans in one inline flow inside the centered box", () => {
  const { container } = renderRow("\x1b[33mgpt-6-astra \x1b[36mxhigh\x1b[0m");
  const field = container.querySelector('[title="gpt-6-astra xhigh"]')!;
  expect(field.children).toHaveLength(1);
  expect(field.firstElementChild).toHaveTextContent("gpt-6-astra xhigh");
  expect(field.firstElementChild?.children).toHaveLength(2);
});

it.each<[Locale, string, string, boolean]>([
  ["zh", "余", "用", true],
  ["ja", "残", "使用", true],
  ["ko", "잔여", "사용", true],
  ["de", "frei", "belegt", false],
  ["es", "libre", "usado", false],
])("updates context labels in place when switching to %s", async (locale, remaining, used, prefix) => {
  const { container } = renderRow("Context 77% left \u00b7 Context 23% used");
  await act(async () => {
    setLocale(locale);
    await whenLocaleReady(locale);
  });
  for (const label of [remaining, used]) {
    const node = within(container).getByText(label);
    expect(node.parentElement?.classList.contains("flex-row-reverse")).toBe(prefix);
  }
  if (locale === "zh") {
    expect(within(container).getByRole("img", { name: "上下文剩余 77%" })).toBeInTheDocument();
    expect(within(container).getByRole("img", { name: "上下文已用 23%" })).toBeInTheDocument();
  }
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
  expect(within(strip).getByText("77%").parentElement).toHaveClass("w-[4ch]", "tabular-nums");
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
  expect(container.firstElementChild).toHaveClass("truncate");
  expect(within(container).queryAllByRole("img")).toHaveLength(0);
  expect(within(container).getByText("Context 73% left").style.color).toBe("var(--ansi-6)");
});
