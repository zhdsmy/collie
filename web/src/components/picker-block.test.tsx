import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PickerModel } from "@/lib/harness/picker-model";
import { PickerBlock } from "./picker-block";

const segment = (text: string) => ({ text, style: { color: "#fafafa" }, muted: false });

const singlePicker: PickerModel = {
  kind: "single",
  identity: "model:gpt-5",
  title: "Select Model and Effort",
  description: ["Choose the model and reasoning level."],
  options: [
    {
      id: "gpt-5",
      label: "gpt-5",
      description: "Optimized for Codex",
      pointed: true,
      current: true,
      checked: false,
      orderable: true,
    },
    {
      id: "gpt-5-mini",
      label: "gpt-5-mini",
      description: "Faster responses",
      pointed: false,
      current: false,
      checked: false,
      orderable: true,
    },
  ],
  query: null,
  preview: [{ segments: [segment("model preview")] }],
  footer: "Press enter to confirm or esc to go back",
  signature: "single-signature",
  regionSignature: "single-region",
};

const multiplePicker: PickerModel = {
  kind: "multiple",
  identity: "statusline",
  title: "Configure Status Line",
  description: ["Select which items to display in the status line."],
  options: [
    {
      id: "status-line-use-theme-colors",
      label: "Use theme colors",
      description: "Apply colors from the active theme",
      pointed: false,
      current: true,
      checked: true,
      orderable: false,
    },
    {
      id: "project-name",
      label: "project-name",
      description: "Project name",
      pointed: true,
      current: true,
      checked: true,
      orderable: true,
    },
    {
      id: "git-branch",
      label: "git-branch",
      description: "Current Git branch",
      pointed: false,
      current: false,
      checked: false,
      orderable: true,
    },
  ],
  query: "",
  preview: [],
  footer: "Press space to toggle; ←/→ to move; enter to confirm and close; esc to close",
  signature: "multiple-signature",
  regionSignature: "multiple-region",
};

describe("PickerBlock", () => {
  it("renders a single picker as tappable cards with pointer, current mark, preview, and footer", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={singlePicker} onAction={onAction} />);

    expect(screen.getByRole("group", { name: "Select Model and Effort" })).toBeInTheDocument();
    expect(screen.getByText("Choose the model and reasoning level.")).toBeInTheDocument();
    expect(screen.getByText("model preview")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Picker preview" })).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Keyboard help" })).toHaveTextContent(
      "Press enter to confirm",
    );

    const current = screen.getByText("gpt-5", { exact: true }).closest("button")!;
    expect(within(current).getByLabelText("Current selection")).toBeInTheDocument();
    expect(current.parentElement).toHaveTextContent("gpt-5");

    await user.click(screen.getByRole("button", { name: /gpt-5-mini/ }));
    expect(onAction).toHaveBeenCalledWith({ kind: "choose", id: "gpt-5-mini" });
  });

  it("exposes cancel for a single picker", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={singlePicker} onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "cancel" });
  });

  it("toggles multiple rows and keeps reorder controls outside the checkbox button", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={multiplePicker} onAction={onAction} />);

    const project = screen.getByRole("checkbox", { name: /project-name/ });
    expect(project.querySelector("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Move project-name down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move project-name up" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Move Use theme colors up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move Use theme colors down" })).toBeNull();

    await user.click(project);
    expect(onAction).toHaveBeenCalledWith({ kind: "toggle", id: "project-name" });
    await user.click(screen.getByRole("button", { name: "Move project-name down" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "move", id: "project-name", direction: "down" });
  });

  it("applies statusline search through the visible control without confirming the terminal", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={multiplePicker} onAction={onAction} />);
    const search = screen.getByRole("searchbox", { name: "Search picker options" });

    await user.type(search, "branch");
    const apply = screen.getByRole("button", { name: "Apply" });
    expect(apply).toBeVisible();
    await user.click(apply);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "search", query: "branch" });
    expect(onAction).not.toHaveBeenCalledWith({ kind: "confirm" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "search", query: "" });
  });

  it("normalizes the local search draft before applying an unchanged native query", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const nativeQuery = { ...multiplePicker, query: "context" };

    render(<PickerBlock picker={nativeQuery} onAction={onAction} />);

    const search = screen.getByRole("searchbox", { name: "Search picker options" });
    fireEvent.change(search, { target: { value: "context " } });
    expect(search).toHaveValue("context ");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onAction).toHaveBeenCalledWith({ kind: "search", query: "context" });
    expect(search).toHaveValue("context");
  });

  it("keeps Enter as a keyboard shortcut for the same search submit", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={multiplePicker} onAction={onAction} />);
    const search = screen.getByRole("searchbox", { name: "Search picker options" });

    await user.type(search, "context");
    await user.keyboard("{Enter}");

    expect(onAction).toHaveBeenCalledWith({ kind: "search", query: "context" });
    expect(onAction).not.toHaveBeenCalledWith({ kind: "confirm" });
  });

  it("disables reordering while search is active and exposes browse navigation", () => {
    const filtered = { ...multiplePicker, query: "branch" };
    render(<PickerBlock picker={filtered} onAction={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Browse options above" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Browse options below" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move git-branch up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move git-branch down" })).toBeDisabled();
  });

  it("raises navigation and cancel intents, and disables every control in read-only mode", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const view = render(<PickerBlock picker={multiplePicker} onAction={onAction} disabled />);

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByRole("searchbox", { name: "Search picker options" })).toBeDisabled();

    view.rerender(<PickerBlock picker={multiplePicker} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Browse options below" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "navigate", direction: "down" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "cancel" });
  });

  it("submits the multiple picker only from the explicit confirm control", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={multiplePicker} onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: "Confirm and close" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "confirm" });
  });
});

// Keep a native form submit assertion independent from user-event's keyboard implementation.
it("prevents the search form's native submit from bubbling", () => {
  const onAction = vi.fn();
  render(<PickerBlock picker={multiplePicker} onAction={onAction} />);
  fireEvent.submit(screen.getByRole("search"));
  expect(onAction).toHaveBeenCalledWith({ kind: "search", query: "" });
  expect(onAction).not.toHaveBeenCalledWith({ kind: "confirm" });
});
