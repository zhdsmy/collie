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
import {
  __resetCodexModelRecents,
  CODEX_MODEL_RECENTS_STORAGE_KEY,
  recordRecent,
} from "@/lib/codex-model-recents";
import { AgentChat } from "./agent-chat";

vi.mock("@/lib/codex-model-switch", () => ({ runCodexModelSwitch: vi.fn() }));

const idle = readFileSync(join(process.cwd(), "src/fixtures/panes/codex--v0154-statusline-single-idle.txt"), "utf8");
/** The same pane with its level printed beside the model, the way Codex 0.154 draws it. */
const withLevel = readFileSync(join(process.cwd(), "src/fixtures/panes/codex--v0154-statusline-multiple-muted-default.txt"), "utf8");
/** A codex pane whose composer the adapter can verify — one draft row instead of a wrapped one. */
const draftPane = readFileSync(join(process.cwd(), "src/fixtures/panes/codex--v0150-draft-wrapped.txt"), "utf8");

/**
 * That capture with its long wrapped draft replaced by `draft` — the prompt row keeps its own paint,
 * the continuation rows go. An empty draft gets the placeholder back, because a codex pane with an
 * empty prompt row is not a pane the adapter reads as a composer any more.
 */
function codexPaneWithDraft(draft: string): string {
  const lines = draftPane.split("\n");
  const start = lines.findIndex((line) => line.includes("The quick brown fox"));
  const end = lines.findIndex((line) => line.includes("before the bridge presses enter"));
  const prompt = lines[start]!.replace(/The quick brown fox.*\r?$/, draft || "Ask Codex to do anything");
  lines.splice(start, end - start + 1, prompt);
  return lines.join("\n");
}

/** The history as it is on the device, compared as text so the assertion needs no cast. */
function storedRaw(): string | null {
  return localStorage.getItem(CODEX_MODEL_RECENTS_STORAGE_KEY);
}

function pairs(...entries: [string, string][]): string {
  return JSON.stringify(entries.map(([model, effort]) => ({ model, effort })));
}

beforeEach(() => {
  vi.mocked(runCodexModelSwitch).mockReset();
  localStorage.clear();
  __resetCodexModelRecents();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
});

function renderPane(status: AgentStatus = "idle", pane = idle) {
  const agent = { ...fixtureAgents[0]!, agent: "codex", status };
  return render(<RouterProvider router={createMemoryRouter([{ path: "/", element: withHeaderHost(
    <AgentChat paneId={agent.paneId} agent={agent} agents={[agent]} shellPanes={[]} tabs={[]} text={pane} onBack={vi.fn()} onSelect={vi.fn()} />,
  ) }])} />);
}

/** The statusline's model field, which is a button only when the history has somewhere to go. */
async function openRecents(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /gpt-5\.6/ }));
  return screen.getByRole("dialog");
}

it("keeps the model field openable when history is empty", async () => {
  const user = userEvent.setup();
  renderPane("idle", withLevel);

  const panel = await openRecents(user);

  expect(within(panel).getByText("No models used yet.")).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "Choose model" })).toBeEnabled();
});

it("keeps the current pair visible and openable when it is the only recent", async () => {
  const user = userEvent.setup();
  recordRecent("gpt-5.6-sol", "high");
  renderPane("idle", withLevel);

  const panel = await openRecents(user);

  expect(within(panel).getByRole("button", { name: /^gpt-5\.6-sol high$/ })).toBeEnabled();
});

it("opens the menu from the model field once a second pair has been used", async () => {
  const user = userEvent.setup();
  recordRecent("gpt-5.6-sol", "high");
  recordRecent("gpt-5.6-luna", "max");
  renderPane("idle", withLevel);

  const panel = await openRecents(user);

  expect(within(panel).getByRole("button", { name: /gpt-5\.6-luna max/ })).toBeEnabled();
});

it("keeps text and an uploaded image mounted and locked while switching, then restores them", async () => {
  const user = userEvent.setup();
  let finish!: (value: Awaited<ReturnType<typeof runCodexModelSwitch>>) => void;
  vi.mocked(runCodexModelSwitch).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  server.use(http.post(/\/api\/pane\/[^/]+\/upload$/, () => HttpResponse.json({ ok: true, path: "/tmp/preserved-photo.png" })));
  recordRecent("gpt-5.6-luna", "max");
  renderPane();
  const draft = screen.getByRole<HTMLTextAreaElement>("textbox");
  await user.type(draft, "Keep this draft\nwith a second line");
  fireEvent.change(screen.getByTestId("attach-files"), { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
  await waitFor(() => expect(draft.value).toContain("/tmp/preserved-photo.png"));
  const savedDraft = draft.value;
  const panel = await openRecents(user);
  expect(draft).not.toHaveFocus();
  await user.click(within(panel).getByRole("button", { name: "gpt-5.6-luna max" }));
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

it("allows inspecting the history while working but never queues a switch", async () => {
  const user = userEvent.setup();
  recordRecent("gpt-5.6-luna", "max");
  renderPane("working");
  const panel = await openRecents(user);
  const choice = within(panel).getByRole("button", { name: "gpt-5.6-luna max" });
  expect(choice).toBeDisabled();
  await user.click(choice);
  expect(runCodexModelSwitch).not.toHaveBeenCalled();
});

it("cancels the remaining steps when the menu is closed", async () => {
  const user = userEvent.setup();
  vi.mocked(runCodexModelSwitch).mockImplementation(({ signal }) => new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve({ status: "cancelled" }), { once: true });
  }));
  recordRecent("gpt-5.6-luna", "max");
  renderPane();
  const panel = await openRecents(user);
  await user.click(within(panel).getByRole("button", { name: "gpt-5.6-luna max" }));
  await waitFor(() => expect(runCodexModelSwitch).toHaveBeenCalledOnce());
  await user.keyboard("{Escape}");
  expect(vi.mocked(runCodexModelSwitch).mock.calls[0]![0].signal.aborted).toBe(true);
  await waitFor(() => expect(screen.getByRole("textbox")).not.toBeDisabled());
});

it("removes one entry from the menu without switching to it", async () => {
  const user = userEvent.setup();
  recordRecent("gpt-6-astra", "xhigh");
  recordRecent("gpt-5.6-luna", "max");
  renderPane();
  const panel = await openRecents(user);

  await user.click(within(panel).getByRole("button", { name: "Remove gpt-5.6-luna · max" }));

  expect(storedRaw()).toBe(pairs(["gpt-6-astra", "xhigh"]));
  expect(runCodexModelSwitch).not.toHaveBeenCalled();
});

it("clears the history on the second tap only", async () => {
  const user = userEvent.setup();
  recordRecent("gpt-5.6-luna", "max");
  renderPane();
  const panel = await openRecents(user);

  await user.click(within(panel).getByRole("button", { name: /Clear history/ }));
  expect(storedRaw()).toBe(pairs(["gpt-5.6-luna", "max"]));

  await user.click(within(panel).getByRole("button", { name: /Tap again to clear/ }));
  expect(storedRaw()).toBe("[]");
});

it("records the pair only once a reply has actually been sent with it", async () => {
  const user = userEvent.setup();
  // The guarded reply types, then polls until it can SEE its own words in the composer before it
  // presses Enter — so the fake pane has to carry the draft back, the way `test/handlers.ts` does for
  // Claude's box. The pane prop is the capture above (that is what the statusline is read from) while
  // the GET handler answers with a codex composer the adapter can actually verify.
  let typed = "";
  server.use(
    http.post<never, { text?: string; submit?: boolean }>(/\/api\/pane\/[^/]+\/reply$/, async ({ request }) => {
      const body = await request.json();
      typed = body.submit ? "" : body.text ?? "";
      return HttpResponse.json({ ok: true });
    }),
    http.get(/\/api\/pane\/[^/]+$/, () =>
      HttpResponse.json({
        paneId: "w1:p1",
        text: codexPaneWithDraft(typed),
        truncated: false,
        revision: 1,
      }),
    ),
  );
  renderPane("idle", withLevel);
  const draft = screen.getByRole<HTMLTextAreaElement>("textbox");

  // Nothing yet: standing in a pane whose statusline names a model is not having USED it.
  expect(storedRaw()).toBeNull();

  await user.type(draft, "try this one");
  await user.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(storedRaw()).toBe(pairs(["gpt-5.6-sol", "high"])));
});
