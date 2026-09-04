import { render, screen } from "@testing-library/react";

import type { AnsiSegment } from "@/lib/ansi";
import { StatuslineSegment } from "./statusline-segment";

const segment = (text: string): AnsiSegment => ({ text, style: {}, muted: false });

describe("StatuslineSegment", () => {
  it("renders Fast on as a solid lightning icon and Fast off as an outline", () => {
    const { rerender } = render(<StatuslineSegment agent="codex" segment={segment("Fast:on")} />);

    expect(screen.getByLabelText("Fast on").querySelector("svg")).toHaveAttribute(
      "fill",
      "currentColor",
    );

    rerender(<StatuslineSegment agent="codex" segment={segment("Fast:off")} />);
    expect(screen.getByLabelText("Fast off").querySelector("svg")).toHaveAttribute("fill", "none");
  });

  it("uses compact icons for context, approval, and tasks while retaining values", () => {
    render(
      <StatuslineSegment
        agent="codex"
        segment={segment("Ctx 19% · Approve · Tasks 3/3")}
      />,
    );

    const context = screen.getByLabelText("Context 19% left");
    expect(context).toHaveTextContent("19%");
    expect(context.querySelector('[data-status-icon="context"]')).toHaveAttribute(
      "data-value",
      "19",
    );
    expect(screen.getByLabelText("Approve for me")).toHaveAttribute(
      "data-status-icon",
      "approval",
    );
    expect(screen.getByLabelText("Tasks 3/3")).toHaveTextContent("3/3");
  });

  it("uses a circular check for Ready and an hourglass for Working", () => {
    render(<StatuslineSegment agent="codex" segment={segment("Ready · Working")} />);

    expect(screen.getByLabelText("Ready")).toHaveAttribute("data-state", "ready");
    expect(screen.getByLabelText("Ready").querySelector("svg")).toHaveClass("lucide-circle-check");
    expect(screen.getByLabelText("Working")).toHaveAttribute("data-state", "working");
    expect(screen.getByLabelText("Working").querySelector("svg")).toHaveClass("lucide-hourglass");
  });

  it.each([
    ["Goal:active", "Pursuing goal", "active", "lucide-target"],
    ["Goal:paused", "Goal paused", "paused", "lucide-pause"],
    ["Goal:blocked", "Goal stalled", "blocked", "lucide-circle-alert"],
    ["Goal:usage", "Goal hit usage limits", "usage", "lucide-gauge"],
    ["Goal:budget", "Goal unmet", "budget", "lucide-circle-off"],
    ["Goal:abandoned", "Goal abandoned", "abandoned", "lucide-circle-off"],
    ["Goal:done", "Goal achieved", "done", "lucide-circle-check"],
  ])("renders %s as an accessible compact goal icon", (token, label, state, iconClass) => {
    render(<StatuslineSegment agent="codex" segment={segment(token)} />);

    const goal = screen.getByLabelText(label);
    expect(goal).toHaveAttribute("data-status-icon", "goal");
    expect(goal).toHaveAttribute("data-state", state);
    expect(goal).toHaveAttribute("title", label);
    expect(goal.querySelector("svg")).toHaveClass(iconClass);
  });

  it("leaves model details and other agents as plain text", () => {
    const { rerender } = render(
      <StatuslineSegment agent="codex" segment={segment("gpt-5.6-sol xhigh")} />,
    );
    expect(screen.getByText("gpt-5.6-sol xhigh")).toBeInTheDocument();

    rerender(<StatuslineSegment agent="claude" segment={segment("Fast:on")} />);
    expect(screen.getByText("Fast:on")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fast on")).not.toBeInTheDocument();
  });
});
