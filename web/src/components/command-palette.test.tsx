import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CommandPalette } from "./command-palette";
import { i18n } from "@/i18n";
import type { OperatorCommand } from "@/lib/types";

function setup(overrides?: {
  agent?: string | null;
  mine?: OperatorCommand[];
  keyboardBottomInset?: number;
}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    agent: "claude" as string | null | undefined,
    onInsert: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return props;
}

describe("CommandPalette", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows only common commands when the query is empty", () => {
    setup();
    // /status is common; /doctor is not.
    expect(screen.getByText("/status")).toBeInTheDocument();
    expect(screen.queryByText("/doctor")).toBeNull();
  });

  it("filters across the full catalog as you type", async () => {
    const user = userEvent.setup();
    setup();
    const search = screen.getByPlaceholderText(/Search \d+ commands/);
    await user.type(search, "doctor");
    expect(screen.getByText("/doctor")).toBeInTheDocument();
    // Non-matching common commands fall away.
    expect(screen.queryByText("/status")).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByPlaceholderText(/Search \d+ commands/), "zzzznotacommand");
    expect(screen.getByText(/No commands match/)).toBeInTheDocument();
  });

  it("submits a no-arg command immediately and closes", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText("/status"));
    expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith("/status");
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onInsert).not.toHaveBeenCalled();
  });

  it("inserts an arg-taking command into the composer (with trailing space) and closes", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText("/compact")); // takesArg: true
    expect(props.onInsert).toHaveBeenCalledExactlyOnceWith("/compact ");
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("requires a two-tap confirm for a dangerous no-arg command", async () => {
    const user = userEvent.setup();
    const props = setup();

    // /clear is dangerous + no-arg. First tap arms confirm, does not submit.
    await user.click(screen.getByText("/clear"));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm?")).toBeInTheDocument();

    // Second tap submits and closes.
    await user.click(screen.getByText("/clear"));
    expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith("/clear");
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing for an unknown agent (empty catalog → sheet still opens but no commands)", () => {
    setup({ agent: "gemini" });
    expect(screen.queryByText("/status")).toBeNull();
    expect(screen.queryByText("/compact")).toBeNull();
  });

  it("shows one of the operator's own commands on the first screen and submits it", async () => {
    const user = userEvent.setup();
    const props = setup({
      agent: "omp",
      mine: [
        {
          agent: "omp",
          command: "/fork-in-herdr",
          description: "Fork into a new herdr tab",
          takesArg: false,
          argHint: "",
        },
      ],
    });
    // No search needed — an operator-declared row is common by construction.
    await user.click(screen.getByText("/fork-in-herdr"));
    expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith("/fork-in-herdr");
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("gives an agent with no catalog a palette when an unscoped row applies", () => {
    setup({
      agent: "gemini",
      mine: [{ command: "/deploy", description: "Ship it", takesArg: false, argHint: "" }],
    });
    expect(screen.getByText("/deploy")).toBeInTheDocument();
  });

  it("renders one button when a scoped and an unscoped row name the same command", () => {
    setup({
      agent: "omp",
      mine: [
        { command: "/deploy", description: "Everywhere", takesArg: false, argHint: "" },
        { agent: "omp", command: "/deploy", description: "On omp", takesArg: false, argHint: "" },
      ],
    });
    // getAllByText, not getByText: two rows would also mean two children under one React key.
    expect(screen.getAllByText("/deploy")).toHaveLength(1);
    expect(screen.getByText("On omp")).toBeInTheDocument();
  });

  it("shows the operator's rows INSTEAD of the shipped catalog", () => {
    setup({
      agent: "omp",
      mine: [
        { agent: "omp", command: "/fork-in-herdr", description: "Fork", takesArg: false, argHint: "" },
      ],
    });
    expect(screen.getByText("/fork-in-herdr")).toBeInTheDocument();
    // The sheet is the operator's shortcuts now — no searching past ten rows nobody picked.
    expect(screen.queryByText("/compact")).toBeNull();
  });

  it("localizes shipped descriptions and searches them while keeping operator copy verbatim", async () => {
    await i18n.changeLanguage("zh-CN");
    const user = userEvent.setup();
    const { unmount } = render(
      <CommandPalette
        open
        onClose={() => {}}
        agent="claude"
        onInsert={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText("总结对话以释放上下文；可选指定重点")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/搜索 51 个命令/), "剪贴板");
    expect(screen.getByText("/copy")).toBeInTheDocument();
    unmount();

    setup({
      agent: "omp",
      mine: [
        {
          agent: "omp",
          command: "/fork-in-herdr",
          description: "Fork into a new herdr tab",
          takesArg: false,
          argHint: "",
        },
      ],
    });
    expect(screen.getByText("Fork into a new herdr tab")).toBeInTheDocument();
  });

  it("still asks twice before a renamed destructive command", async () => {
    const user = userEvent.setup();
    const props = setup({
      agent: "omp",
      mine: [
        { agent: "omp", command: "/new", description: "Fresh start", takesArg: false, argHint: "" },
      ],
    });
    await user.click(screen.getByText("Fresh start"));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm?")).toBeInTheDocument();
    await user.click(screen.getByText("Fresh start"));
    expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith("/new");
  });

  it("asks twice before a row the operator marked confirm", async () => {
    const user = userEvent.setup();
    const props = setup({
      agent: "omp",
      mine: [
        {
          agent: "omp",
          command: "/deploy",
          description: "Deploy staging",
          takesArg: false,
          argHint: "",
          confirm: true,
        },
      ],
    });
    // Same two-tap a shipped dangerous command gets — the operator's own brake, on their own row.
    await user.click(screen.getByText("Deploy staging"));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm?")).toBeInTheDocument();
    await user.click(screen.getByText("Deploy staging"));
    expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith("/deploy");
  });

  it("keeps the palette at a fixed height with an independently scrolling command list", () => {
    setup();
    const panel = screen.getByRole("dialog").querySelector<HTMLElement>(".relative.z-10");

    expect(panel).not.toBeNull();
    if (!panel) throw new Error("BottomSheet panel not found");
    const list = panel.querySelector(".overflow-y-auto");
    expect(panel).toHaveClass("h-[min(72dvh,36rem)]", "min-h-0", "flex", "flex-col", "overflow-hidden");
    expect(list).not.toBeNull();
    expect(list).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
  });

  it("lifts the palette above an overlaid software keyboard", () => {
    setup({ keyboardBottomInset: 280 });
    const panel = screen.getByRole("dialog").querySelector<HTMLElement>(".relative.z-10");

    expect(panel).not.toBeNull();
    if (!panel) throw new Error("BottomSheet panel not found");
    expect(panel).toHaveStyle({ marginBottom: "280px" });
  });
});
