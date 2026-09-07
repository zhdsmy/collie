import { describe, expect, test, vi } from "vitest";
import { decidePush } from "./push-decision";
import { displayPush } from "./push-display";

function registration(existing = true) {
  const close = vi.fn();
  const getNotifications = vi.fn(async () => existing ? [{ close }] : []);
  const showNotification = vi.fn(async (_title: string, _options: NotificationOptions) => {});
  return { close, getNotifications, showNotification };
}

describe("push delivery", () => {
  test("retractions update an existing slot silently", async () => {
    const target = registration();
    await displayPush(decidePush({ title: "codex is done", tag: "collie:herd", renotify: false }, false), target);
    expect(target.getNotifications).toHaveBeenCalledWith({ tag: "collie:herd" });
    expect(target.showNotification).toHaveBeenCalledWith("codex is done", expect.objectContaining({
      tag: "collie:herd", renotify: false, silent: true,
    }));
  });

  test("a retraction never revives a notification the user already dismissed", async () => {
    const target = registration(false);
    await displayPush(decidePush({ tag: "collie:herd", renotify: false }, false), target);
    expect(target.showNotification).not.toHaveBeenCalled();
  });

  test("a new alert still buzzes and retains its host/session deep link", async () => {
    const target = registration(false);
    await displayPush(decidePush({ title: "codex is done", renotify: true,
      tag: "collie:herd@laptop", data: { paneId: "p1", host: "laptop", session: "work" },
    }, false), target);
    expect(target.getNotifications).not.toHaveBeenCalled();
    expect(target.showNotification).toHaveBeenCalledWith("codex is done", expect.objectContaining({
      tag: "collie:herd@laptop", renotify: true, silent: false,
      data: { paneId: "p1", host: "laptop", session: "work" },
      icon: "/notification-icon-192x192.png", badge: "/badge-96x96.png",
    }));
  });

  test("manual and legacy pushes with omitted renotify still show normally", async () => {
    const target = registration(false);
    await displayPush(decidePush({ title: "test" }, false), target);
    expect(target.showNotification).toHaveBeenCalledWith("test", expect.objectContaining({
      renotify: false, silent: false,
    }));
  });

  test("clear closes the exact slot even with a visible client", async () => {
    const target = registration();
    await displayPush(decidePush({ type: "clear", tag: "collie:herd@laptop" }, true), target);
    expect(target.getNotifications).toHaveBeenCalledWith({ tag: "collie:herd@laptop" });
    expect(target.close).toHaveBeenCalledOnce();
    expect(target.showNotification).not.toHaveBeenCalled();
  });

  test("visible clients suppress both new alerts and summary updates", async () => {
    const target = registration();
    for (const renotify of [true, false]) {
      await displayPush(decidePush({ tag: "collie:herd", renotify }, true), target);
    }
    expect(target.getNotifications).not.toHaveBeenCalled();
    expect(target.showNotification).not.toHaveBeenCalled();
  });
});
