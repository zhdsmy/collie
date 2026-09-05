import { render, within } from "@testing-library/react";

import { parseAnsi } from "@/lib/ansi";
import { lineText, splitLines } from "@/lib/blocks";
import { StatuslineRow } from "./statusline-row";

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
    expect(field.querySelector("svg")).toHaveClass("size-[11px]");
  }
  expect(lineText(row)).toBe(text);
  const strip = container.querySelector('[data-slot="codex-statusline"]')!;
  expect(strip).toHaveClass("gap-1.5", "min-h-3.5", "overflow-x-auto", "whitespace-nowrap");
  expect(strip).not.toHaveClass("truncate");
});

it.each([
  ["Context 62% left", "62%", "lucide-gauge"],
  ["Context 38% used", "38% used", "lucide-gauge"],
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
  expect(field.querySelector("svg")?.style.color).toBe("var(--ansi-3)");
  expect(within(field).getByText("73%").style.color).toBe("var(--ansi-6)");
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
