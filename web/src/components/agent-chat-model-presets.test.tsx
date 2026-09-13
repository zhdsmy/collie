import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";

import { fixtureAgents } from "@/test/handlers";
import { server } from "@/test/setup";
import { withHeaderHost } from "@/test/header-host";
import type { AgentStatus } from "@/lib/types";
import { runCodexModelSwitch } from "@/lib/codex-model-switch";
import { AgentChat } from "./agent-chat";

vi.mock("@/lib/codex-model-switch", () => ({ runCodexModelSwitch: vi.fn() }));

const idle = readFileSync(join(process.cwd(), "src/fixtures/panes/codex--v0154-statusline-single-idle.txt"), "utf8");

beforeEach(() => {
  vi.mocked(runCodexModelSwitch).mockReset();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

function renderPane(status: AgentStatus = "idle") {
  const agent = { ...fixtureAgents[0]!, agent: "codex", status };
  return render(<RouterProvider router={createMemoryRouter([{ path: "/", element: withHeaderHost(
    <AgentChat paneId={agent.paneId} agent={agent} agents={[agent]} shellPanes={[]} tabs={[]} text={idle} onBack={vi.fn()} onSelect={vi.fn()} />,
  ) }])} />);
}

async function openPresets(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /gpt-5\.6/ }));
  return screen.getByRole("dialog");
}

it("keeps text and an uploaded image mounted and locked while switching, then restores them", async () => {
  const user = userEvent.setup();
  let finish!: (value: Awaited<ReturnType<typeof runCodexModelSwitch>>) => void;
  vi.mocked(runCodexModelSwitch).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  server.use(http.post(/\/api\/pane\/[^/]+\/upload$/, () => HttpResponse.json({ ok: true, path: "/tmp/preserved-photo.png" })));
  renderPane();
  const draft = screen.getByRole<HTMLTextAreaElement>("textbox");
  await user.type(draft, "Keep this draft\nwith a second line");
  fireEvent.change(screen.getByTestId("attach-files"), { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
  await waitFor(() => expect(draft.value).toContain("/tmp/preserved-photo.png"));
  const savedDraft = draft.value;
  const panel = await openPresets(user);
  expect(draft).not.toHaveFocus();
  await user.click(within(panel).getByText("gpt-5.6-luna"));
  await waitFor(() => expect(runCodexModelSwitch).toHaveBeenCalledOnce());
  expect(draft).toBeDisabled();
  expect(draft).toHaveValue(savedDraft);
  expect(vi.mocked(runCodexModelSwitch).mock.calls[0]![0]).toMatchObject({
    paneId: "w1:p1", preset: { model: "gpt-5.6-luna", effort: "max" },
  });
  finish({ status: "switched" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(draft).not.toBeDisabled();
  expect(draft).toHaveValue(savedDraft);
});

it("allows inspecting presets while working but never queues a switch", async () => {
  const user = userEvent.setup();
  renderPane("working");
  const panel = await openPresets(user);
  const choice = within(panel).getByText("gpt-5.6-luna").closest("button");
  expect(choice).toBeDisabled();
  await user.click(within(panel).getByText("gpt-5.6-luna"));
  expect(runCodexModelSwitch).not.toHaveBeenCalled();
});

it("cancels the remaining steps when the preset sheet is closed", async () => {
  const user = userEvent.setup();
  vi.mocked(runCodexModelSwitch).mockImplementation(({ signal }) => new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve({ status: "cancelled" }), { once: true });
  }));
  renderPane();
  const panel = await openPresets(user);
  await user.click(within(panel).getByText("gpt-5.6-luna"));
  await waitFor(() => expect(runCodexModelSwitch).toHaveBeenCalledOnce());
  await user.keyboard("{Escape}");
  expect(vi.mocked(runCodexModelSwitch).mock.calls[0]![0].signal.aborted).toBe(true);
  await waitFor(() => expect(screen.getByRole("textbox")).not.toBeDisabled());
});
