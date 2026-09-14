import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";

import { fixtureAgents } from "@/test/handlers";
import { withHeaderHost } from "@/test/header-host";
import { runClaudeModeSwitch } from "@/lib/claude-mode-switch";
import { clearStatus } from "@/lib/status";
import { AgentChat } from "./agent-chat";

vi.mock("@/lib/claude-mode-switch", () => ({ runClaudeModeSwitch: vi.fn() }));

const footerSingle = readFileSync(join(process.cwd(), "src/fixtures/panes/claude--draft-footer-single.txt"), "utf8");
const permission = readFileSync(join(process.cwd(), "src/fixtures/panes/claude--permission-edit.txt"), "utf8");

function renderPane(text: string, status: "idle" | "working" = "working") {
  const agent = { ...fixtureAgents[0]!, agent: "claude", status };
  return render(<RouterProvider router={createMemoryRouter([{ path: "/", element: withHeaderHost(
    <AgentChat paneId={agent.paneId} agent={agent} agents={[agent]} shellPanes={[]} tabs={[]} text={text} onBack={vi.fn()} onSelect={vi.fn()} />,
  ) }])} />);
}

beforeEach(() => {
  vi.mocked(runClaudeModeSwitch).mockReset();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  clearStatus();
});

const modeButton = () => screen.getByRole("button", { name: /Claude mode/ });

it("cycles the mode from the statusline with one tap", async () => {
  const user = userEvent.setup();
  vi.mocked(runClaudeModeSwitch).mockResolvedValue({
    status: "switched", text: footerSingle, revision: 1, mode: "⏵⏵ accept edits on",
  });
  renderPane(footerSingle);

  await user.click(modeButton());

  await waitFor(() => expect(runClaudeModeSwitch).toHaveBeenCalledOnce());
  expect(vi.mocked(runClaudeModeSwitch).mock.calls[0]![0]).toMatchObject({ paneId: "w1:p1" });
  await waitFor(() => expect(screen.getByText(/accept edits on/)).toBeInTheDocument());
});

it("stays tappable while Claude is working — the key goes out either way", async () => {
  const user = userEvent.setup();
  vi.mocked(runClaudeModeSwitch).mockResolvedValue({ status: "unconfirmed" });
  // The working capture keeps the mode row; the agent's status is `working`.
  renderPane(footerSingle, "working");

  expect(modeButton()).toBeEnabled();
  await user.click(modeButton());
  await waitFor(() => expect(runClaudeModeSwitch).toHaveBeenCalledOnce());
  // An honest no: the key was sent and nothing confirmed it.
  await waitFor(() => expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument());
});

it("is refused while a permission dialog owns the keyboard", () => {
  renderPane(permission, "idle");
  expect(screen.queryByRole("button", { name: /Claude mode/ })).toBeNull();
});

it("reports a refusal instead of failing silently", async () => {
  const user = userEvent.setup();
  vi.mocked(runClaudeModeSwitch).mockResolvedValue({ status: "error", error: "agent busy" });
  renderPane(footerSingle);

  await user.click(modeButton());
  await waitFor(() => expect(screen.getByText("agent busy")).toBeInTheDocument());
});
