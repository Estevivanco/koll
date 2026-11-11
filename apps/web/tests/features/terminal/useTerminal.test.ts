import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MAX_QUESTION_LENGTH, type Ask, type AskEvent } from "../../../src/api";
import { useTerminal } from "../../../src/features/terminal/useTerminal";

// A fake Ask that answers straight away with the given events
function fakeAsk(...events: AskEvent[]) {
  return vi.fn<Ask>(async function* () {
    yield* events;
  });
}

// A fake Ask that waits until the test says "finish", to look at the terminal while it is busy
function slowAsk() {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => (finish = resolve));
  const ask = vi.fn<Ask>(async function* () {
    await gate;
    yield { type: "answer", text: "klart" };
  });
  return { ask, finish };
}

const answer = (text: string): AskEvent => ({ type: "answer", text });

describe("useTerminal", () => {
  it("starts empty and not busy", () => {
    const { result } = renderHook(() => useTerminal(fakeAsk()));
    expect(result.current.entries).toEqual([]);
    expect(result.current.busy).toBe(false);
  });

  it("adds the question with its events and marks it done", async () => {
    const ask = fakeAsk({ type: "route", agent: "Koll Analyst", reason: "r" }, answer("Hej"));
    const { result } = renderHook(() => useTerminal(ask));

    await act(() => result.current.submit("Hur mycket?"));

    expect(ask).toHaveBeenCalledWith("Hur mycket?");
    expect(result.current.entries).toEqual([
      {
        id: 1,
        question: "Hur mycket?",
        events: [{ type: "route", agent: "Koll Analyst", reason: "r" }, answer("Hej")],
        running: false,
      },
    ]);
    expect(result.current.busy).toBe(false);
  });

  it("keeps the history in order, each question with its own answer", async () => {
    const ask = vi.fn<Ask>(async function* (q) {
      yield answer(`svar på ${q}`);
    });
    const { result } = renderHook(() => useTerminal(ask));

    await act(() => result.current.submit("ett"));
    await act(() => result.current.submit("två"));

    expect(result.current.entries.map((e) => [e.id, e.question, e.events])).toEqual([
      [1, "ett", [answer("svar på ett")]],
      [2, "två", [answer("svar på två")]],
    ]);
  });

  describe("input", () => {
    it.each(["", "   ", "\n"])("ignores an empty question (%j)", async (input) => {
      const ask = fakeAsk(answer("x"));
      const { result } = renderHook(() => useTerminal(ask));

      await act(() => result.current.submit(input));

      expect(ask).not.toHaveBeenCalled();
      expect(result.current.entries).toEqual([]);
    });

    it("trims the question", async () => {
      const ask = fakeAsk(answer("x"));
      const { result } = renderHook(() => useTerminal(ask));

      await act(() => result.current.submit("  hej  "));

      expect(ask).toHaveBeenCalledWith("hej");
    });

    it("cuts a too long question to the maximum length", async () => {
      const ask = fakeAsk(answer("x"));
      const { result } = renderHook(() => useTerminal(ask));

      await act(() => result.current.submit("a".repeat(MAX_QUESTION_LENGTH + 50)));

      expect(ask).toHaveBeenCalledWith("a".repeat(MAX_QUESTION_LENGTH));
    });

    it('clears the history on "clear", in any case, without asking anything', async () => {
      const ask = fakeAsk(answer("x"));
      const { result } = renderHook(() => useTerminal(ask));
      await act(() => result.current.submit("hej"));
      expect(result.current.entries).toHaveLength(1);

      await act(() => result.current.submit("  CLEAR "));

      expect(result.current.entries).toEqual([]);
      expect(ask).toHaveBeenCalledTimes(1);
    });
  });

  describe("one question at a time", () => {
    it("is busy and running while it waits, then done", async () => {
      const { ask, finish } = slowAsk();
      const { result } = renderHook(() => useTerminal(ask));

      let pending!: Promise<void>;
      act(() => {
        pending = result.current.submit("hej");
      });

      await waitFor(() => expect(result.current.busy).toBe(true));
      expect(result.current.entries[0].running).toBe(true);

      await act(async () => {
        finish();
        await pending;
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.entries[0]).toMatchObject({ running: false, events: [answer("klart")] });
    });

    it("ignores a second question while the first is still running", async () => {
      const { ask, finish } = slowAsk();
      const { result } = renderHook(() => useTerminal(ask));

      let first!: Promise<void>;
      act(() => {
        first = result.current.submit("ett");
        void result.current.submit("två"); // the same instant: must be ignored
      });

      await act(async () => {
        finish();
        await first;
      });

      expect(ask).toHaveBeenCalledTimes(1);
      expect(result.current.entries.map((e) => e.question)).toEqual(["ett"]);
    });
  });

  describe("errors", () => {
    it("shows an error thrown by ask as an error event, and is ready again", async () => {
      const ask = vi.fn<Ask>(async function* () {
        yield { type: "agents", names: ["Koll Analyst"] };
        throw new Error("Nätverket föll");
      });
      const { result } = renderHook(() => useTerminal(ask));

      await act(() => result.current.submit("hej"));

      expect(result.current.entries[0]).toMatchObject({
        running: false,
        events: [
          { type: "agents", names: ["Koll Analyst"] },
          { type: "error", text: "Nätverket föll" },
        ],
      });
      expect(result.current.busy).toBe(false);

      // And a new question works afterwards
      await act(() => result.current.submit("igen"));
      expect(ask).toHaveBeenCalledTimes(2);
    });

    it("uses a general message when what was thrown is not an Error", async () => {
      const ask = vi.fn<Ask>(async function* () {
        yield* []; // nothing to send, then it fails with something that is not an Error
        throw "oops";
      });
      const { result } = renderHook(() => useTerminal(ask));

      await act(() => result.current.submit("hej"));

      expect(result.current.entries[0].events).toEqual([{ type: "error", text: "Something went wrong." }]);
    });
  });
});
