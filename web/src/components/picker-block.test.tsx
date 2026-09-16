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

const questionnaireSinglePicker: PickerModel = {
  ...singlePicker,
  identity: "questionnaire:single",
  title: "Which approach should we use?",
  options: [
    { ...singlePicker.options[0]!, current: false, pointed: true },
    { ...singlePicker.options[1]!, current: false, pointed: false },
  ],
  query: null,
  questionnaire: {
    index: 1,
    total: 2,
    unanswered: 2,
    answered: false,
    submit: "answer",
  },
};

const asyncCollapsedPicker: PickerModel = {
  ...questionnaireSinglePicker,
  identity: "async:collapsed",
  title: "Async questions",
  options: [],
  questionnaire: {
    ...questionnaireSinglePicker.questionnaire!,
    index: 0,
    total: 2,
    unanswered: 2,
    async: { collapsed: true, otherId: null },
  },
};

const asyncExpandedPicker: PickerModel = {
  ...questionnaireSinglePicker,
  identity: "async:expanded",
  title: "What should we change?",
  questionnaire: {
    ...questionnaireSinglePicker.questionnaire!,
    async: { collapsed: false, otherId: "gpt-5-mini" },
  },
};

describe("PickerBlock", () => {
  const sessions: PickerModel = {
    ...singlePicker,
    identity: "resume:Resume a previous session",
    sessionAction: "resume",
    title: "Resume a previous session",
    query: "",
    preview: [],
    options: singlePicker.options.map((option, index) => ({
      ...option, id: `session-${index}`, label: index ? "/uploads/very-long-image-filename.jpg Another conversation" : "Collie adapt",
      description: index ? "5d ago · main" : "now", current: false, orderable: false,
    })),
    footer: "enter resume   ctrl+a archive   esc exit",
  };

  it("keeps complete session identities while displaying compact rows and collapsed native help", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={sessions} onAction={onAction} />);
    expect(screen.getByRole("group", { name: "Resume session" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search sessions" })).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Collie adapt" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("main")).toBeVisible();
    expect(screen.getByRole("note", { name: "Keyboard help", hidden: true })).not.toBeVisible();
    await user.click(screen.getByText("Keyboard help"));
    expect(screen.getByRole("note", { name: "Keyboard help" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: sessions.options[1]!.label }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ kind: "choose", id: "session-1" });
  });

  it("searches and browses sessions without confirming them, and distinguishes fork", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<PickerBlock picker={{ ...sessions, sessionAction: "fork" }} onAction={onAction} />);
    expect(screen.getByRole("group", { name: "Fork session" })).toBeVisible();
    await user.type(screen.getByRole("searchbox", { name: "Search sessions" }), "collie");
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: "search", query: "collie" });
    await user.click(screen.getByRole("button", { name: "Browse options below" }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: "navigate", direction: "down" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAction).toHaveBeenLastCalledWith({ kind: "cancel" });
    expect(onAction).not.toHaveBeenCalledWith({ kind: "confirm" });
    rerender(<PickerBlock picker={sessions} onAction={onAction} disabled />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("formats terminal plan Markdown without a matching journal entry", () => {
    const picker: PickerModel = {
      ...singlePicker,
      plan: { text: "# Composer Quick 面板本地化\n\n## Summary\n\n- 显示 **中文**\n- 发送 `继续`\n\n```ts\nconst locale = 'zh';\n```", complete: true },
    };
    render(<PickerBlock picker={picker} onAction={vi.fn()} />);
    const body = screen.getByRole("region", { name: "Plan content" });
    expect(within(body).getByText("Composer Quick 面板本地化", { exact: true })).toBeVisible();
    expect(within(body).getByText("Summary", { exact: true })).toBeVisible();
    expect(within(body).getAllByRole("listitem")).toHaveLength(2);
    expect(body.querySelector("strong")).toHaveTextContent("中文");
    expect(body.querySelector("code")).toHaveTextContent("继续");
    expect(body.querySelector("pre")).toHaveTextContent("const locale = 'zh';");
  });

  it("renders a single picker as tappable cards with pointer, current mark, preview, and footer", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={singlePicker} onAction={onAction} />);

    expect(screen.getByRole("group", { name: "Select Model and Effort" })).toBeInTheDocument();
    expect(screen.getByText("Choose the model and reasoning level.")).toBeInTheDocument();
    expect(screen.getByText("model preview")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Picker preview" })).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "Keyboard help", hidden: true })).not.toBeVisible();
    await user.click(screen.getByText("Keyboard help"));
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
    expect(within(project).getByLabelText("Current selection")).toBeVisible();
    expect(screen.getByRole("button", { name: "Move project-name down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move project-name up" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Move Use theme colors up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move Use theme colors down" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move git-branch up" })).toBeNull();

    await user.click(project);
    expect(onAction).toHaveBeenCalledWith({ kind: "toggle", id: "project-name" });
    await user.click(screen.getByRole("button", { name: "Move project-name down" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "move", id: "project-name", direction: "down" });
  });

  it("follows the native pointer without toggling an item or leaving old reorder controls interactive", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<PickerBlock picker={multiplePicker} onAction={onAction} />);
    const moved = {
      ...multiplePicker,
      options: multiplePicker.options.map((option) => ({ ...option, pointed: option.id === "git-branch" })),
    };
    rerender(<PickerBlock picker={moved} onAction={onAction} />);
    expect(screen.queryByRole("button", { name: "Move project-name down" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /project-name/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /git-branch/ })).not.toBeChecked();
    expect(onAction).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Move git-branch up" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ kind: "move", id: "git-branch", direction: "up" });
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
    const filtered = {
      ...multiplePicker,
      query: "branch",
      options: multiplePicker.options.map((option) => ({ ...option, pointed: option.id === "git-branch" })),
    };
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

  it("renders questionnaire progress and replaces browse controls with question navigation", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={questionnaireSinglePicker} onAction={onAction} />);

    expect(screen.getByText("Question 1/2")).toBeInTheDocument();
    expect(screen.getByText("2 unanswered")).toBeInTheDocument();
    expect(screen.getByText("Which approach should we use?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous question" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next question" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Browse options above" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.queryByRole("note", { name: "Keyboard help" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "question", direction: "next" });
  });

  it("clamps questionnaire navigation and hides it for a single question", () => {
    const onAction = vi.fn();
    const lastQuestion = {
      ...questionnaireSinglePicker,
      questionnaire: { ...questionnaireSinglePicker.questionnaire!, index: 2 },
    };
    const view = render(<PickerBlock picker={lastQuestion} onAction={onAction} />);

    expect(screen.getByRole("button", { name: "Previous question" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next question" })).toBeDisabled();

    view.rerender(
      <PickerBlock
        picker={{ ...lastQuestion, questionnaire: { ...lastQuestion.questionnaire!, index: 1, total: 1 } }}
        onAction={onAction}
      />,
    );
    expect(screen.queryByRole("button", { name: "Previous question" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next question" })).toBeNull();
  });

  it("uses the terminal pointer for questionnaire activity and focuses single options", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<PickerBlock picker={questionnaireSinglePicker} onAction={onAction} />);

    const pointed = screen.getAllByRole("button", { name: /gpt-5/ })[0]!;
    expect(pointed).toHaveClass("border-primary");
    expect(within(pointed).queryByLabelText("Current selection")).toBeNull();

    await user.click(screen.getByRole("button", { name: /gpt-5-mini/ }));
    expect(onAction).toHaveBeenCalledWith({ kind: "focus", id: "gpt-5-mini" });
    expect(onAction).not.toHaveBeenCalledWith({ kind: "choose", id: "gpt-5-mini" });
  });

  it("labels questionnaire submission and blocks final submit while other questions remain", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const incomplete = {
      ...questionnaireSinglePicker,
      questionnaire: {
        ...questionnaireSinglePicker.questionnaire!,
        index: 2,
        total: 2,
        submit: "all" as const,
        unanswered: 2,
        answered: false,
      },
    };
    const view = render(<PickerBlock picker={incomplete} onAction={onAction} />);

    expect(screen.getByText("Answer the remaining questions before submitting.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit all answers" })).toBeDisabled();

    view.rerender(
      <PickerBlock
        picker={{ ...questionnaireSinglePicker, questionnaire: { ...questionnaireSinglePicker.questionnaire!, submit: "answer" } }}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "answer", notes: "" });
  });

  it("keeps local notes through polls and question navigation without terminal writes", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<PickerBlock picker={questionnaireSinglePicker} onAction={onAction} />);
    const input = screen.getByRole("textbox", { name: "Notes or custom answer (optional)" });
    expect(input).not.toHaveFocus();
    await user.type(input, "More details");
    expect(onAction).not.toHaveBeenCalled();
    rerender(<PickerBlock picker={{ ...questionnaireSinglePicker }} onAction={onAction} />);
    expect(input).toHaveValue("More details");
    rerender(<PickerBlock picker={{ ...questionnaireSinglePicker, identity: "question:2" }} onAction={onAction} />);
    expect(input).toHaveValue("");
    rerender(<PickerBlock picker={questionnaireSinglePicker} onAction={onAction} />);
    expect(input).toHaveValue("More details");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "answer", notes: "More details" });
  });

  it("disables questionnaire controls in read-only mode", () => {
    render(<PickerBlock picker={questionnaireSinglePicker} onAction={vi.fn()} disabled />);

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("renders collapsed async questions without stealing composer focus", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(<PickerBlock picker={asyncCollapsedPicker} onAction={onAction} />);

    expect(screen.getByText("2 questions waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Answer" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Back to input" })).toBeNull();
    expect(screen.queryByText("Question 0/2")).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous question" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next question" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("No matching options")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(onAction).toHaveBeenCalledWith({ kind: "expand" });
  });

  it("uses async notes as custom answers and requires text for Other", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    const picker = {
      ...asyncExpandedPicker,
      options: asyncExpandedPicker.options.map((option) => ({
        ...option,
        pointed: option.id === "gpt-5-mini",
      })),
    };

    render(<PickerBlock picker={picker} onAction={onAction} />);

    const input = screen.getByRole("textbox", { name: "Custom answer" });
    const submit = screen.getByRole("button", { name: "Submit answer" });
    expect(input).toHaveAttribute("placeholder", "Write a custom answer");
    expect(submit).toBeDisabled();

    await user.type(input, "Use the compact layout");
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onAction).toHaveBeenCalledWith({ kind: "answer", notes: "Use the compact layout" });
  });

  it("clears a custom draft when an async named option is selected", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<PickerBlock picker={asyncExpandedPicker} onAction={onAction} />);

    const input = screen.getByRole("textbox", { name: "Custom answer" });
    await user.type(input, "Use the compact layout");
    await user.click(screen.getAllByRole("button", { name: /gpt-5/ })[0]!);

    expect(input).toHaveValue("");
    expect(onAction).toHaveBeenCalledWith({ kind: "focus", id: "gpt-5" });
  });

  it("does not show an empty-options error for async free-text questions", () => {
    const picker: PickerModel = {
      ...asyncExpandedPicker,
      options: [],
      questionnaire: {
        ...asyncExpandedPicker.questionnaire!,
        async: { collapsed: false, otherId: null },
      },
    };

    render(<PickerBlock picker={picker} onAction={vi.fn()} />);

    expect(screen.queryByText("No matching options")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Custom answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeDisabled();
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
