import { act, renderHook } from "@testing-library/react";

import { lineText, splitLines } from "@/lib/blocks";
import { parseAnsi } from "@/lib/ansi";
import type { StyledLine } from "@/lib/blocks";
import { STATUSLINE_HOLD_MS, useHeldStatusLines } from "./use-held-statuslines";

const rows = (text: string) => splitLines(parseAnsi(text));
const TEXT = (rows_: readonly { segments: { text: string }[] }[]) => rows_.map((r) => r.segments.map((s) => s.text).join("")).join(" | ");
/** What a TORN frame hands the hook: the adapter found no footer, so there is no strip — not a blank
 *  one. (`splitLines` of an empty string is one empty ROW, which is a different thing.) */
const TORN: StyledLine[] = [];
const LIVE = rows("☤ model │ ctx 32%");

describe("useHeldStatusLines", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("draws the live rows while every poll carries them", () => {
    const { result, rerender } = renderHook(({ rows_: r }) => useHeldStatusLines("w6:pP\u0000hermes", r), {
      initialProps: { rows_: LIVE },
    });
    expect(TEXT(result.current)).toBe("☤ model │ ctx 32%");
    rerender({ rows_: rows("☤ model │ ctx 33%") });
    expect(TEXT(result.current)).toBe("☤ model │ ctx 33%");
  });

  it("holds the strip across a torn frame instead of unmounting it", () => {
    const { result, rerender } = renderHook(({ rows_: r }) => useHeldStatusLines("w6:pP\u0000hermes", r), {
      initialProps: { rows_: LIVE },
    });
    rerender({ rows_: TORN }); // the footer was mid-repaint and the capture had none of it
    expect(TEXT(result.current)).toBe("☤ model │ ctx 32%");
  });

  it("drops it once the footer has been missing for the whole window, not later", () => {
    const { result, rerender } = renderHook(({ rows_: r }) => useHeldStatusLines("w6:pP\u0000hermes", r), {
      initialProps: { rows_: LIVE },
    });
    rerender({ rows_: TORN });
    // A tear survives several polls. Each one must shorten the deadline, never restart it — the pane
    // read was sampled at ~100ms while streaming, so a poll every 1.5s lands inside the window a few
    // times in a row.
    for (let poll = 0; poll < 3; poll++) {
      act(() => vi.advanceTimersByTime(1_500));
      rerender({ rows_: TORN });
      expect(TEXT(result.current)).toBe("☤ model │ ctx 32%");
    }
    act(() => vi.advanceTimersByTime(STATUSLINE_HOLD_MS - 4_500)); // the rest of the original window
    expect(result.current).toHaveLength(0);
  });

  it("lets a live strip cancel a pending drop, and does not re-hold it on the next tear", () => {
    const { result, rerender } = renderHook(({ rows_: r }) => useHeldStatusLines("w6:pP\u0000hermes", r), {
      initialProps: { rows_: LIVE },
    });
    rerender({ rows_: TORN });
    act(() => vi.advanceTimersByTime(STATUSLINE_HOLD_MS - 1));
    rerender({ rows_: rows("☤ model │ ctx 34%") }); // the repaint landed
    act(() => vi.advanceTimersByTime(STATUSLINE_HOLD_MS)); // past where the drop would have fired
    expect(TEXT(result.current)).toBe("☤ model │ ctx 34%");
    rerender({ rows_: TORN }); // ...and a later tear gets its own full window
    expect(TEXT(result.current)).toBe("☤ model │ ctx 34%");
    act(() => vi.advanceTimersByTime(STATUSLINE_HOLD_MS));
    expect(result.current).toHaveLength(0);
  });

  it("adopts a different pane's screen immediately, holding nothing across the change", () => {
    const { result, rerender } = renderHook(({ key, rows_: r }) => useHeldStatusLines(key, r), {
      initialProps: { key: "w6:pP\u0000hermes", rows_: LIVE },
    });
    rerender({ key: "w6:pG\u0000claude", rows_: TORN }); // switched to a pane with no strip yet
    expect(result.current).toHaveLength(0);
    rerender({ key: "w6:pP\u0000hermes", rows_: TORN }); // ...and back: the old rows are gone, not kept
    expect(result.current).toHaveLength(0);
  });

  it("does nothing at all for a pane the strip does not apply to (empty key)", () => {
    const { result, rerender } = renderHook(({ rows_: r }) => useHeldStatusLines("", r), {
      initialProps: { rows_: TORN },
    });
    expect(result.current).toHaveLength(0);
    act(() => vi.advanceTimersByTime(STATUSLINE_HOLD_MS * 2));
    rerender({ rows_: TORN });
    expect(result.current).toHaveLength(0);
  });
});

// The hook is fed by the Hermes capture that showed the tear, so this file and the adapter tests read
// the same screen shape. Kept as a plain assertion: a fixture's footer rows are what a live poll
// carries, and the empty set is what a torn one carries.
it("the live fixture rows are what the hold is asked to preserve", () => {
  expect(lineText(LIVE[0]!)).toContain("ctx 32%");
});
