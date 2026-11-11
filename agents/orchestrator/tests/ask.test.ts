import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanRow, friendlyError } from "../src/ask.js";

describe("cleanRow", () => {
  it("turns numbers written as text into numbers (Postgres sends them as text)", () => {
    expect(cleanRow({ summa: "401.50", antal: "12", skuld: "-30.5" })).toEqual({
      summa: 401.5,
      antal: 12,
      skuld: -30.5,
    });
  });

  it("keeps numbers that already are numbers", () => {
    expect(cleanRow({ summa: 401.5 })).toEqual({ summa: 401.5 });
  });

  it("shows null and undefined as a dash", () => {
    expect(cleanRow({ a: null, b: undefined })).toEqual({ a: "–", b: "–" });
  });

  it("keeps ordinary text as text", () => {
    expect(cleanRow({ category: "Mat" })).toEqual({ category: "Mat" });
  });

  it("does not turn text that only contains digits into a number", () => {
    expect(cleanRow({ a: "2026-10", b: "12 kr", c: "1,5", d: "", e: "1e3", f: ".5" })).toEqual({
      a: "2026-10",
      b: "12 kr",
      c: "1,5",
      d: "",
      e: "1e3",
      f: ".5",
    });
  });

  it("turns other values into text", () => {
    expect(cleanRow({ ok: true, day: new Date("2026-10-01T00:00:00Z") })).toEqual({
      ok: "true",
      day: String(new Date("2026-10-01T00:00:00Z")),
    });
  });
});

describe("friendlyError", () => {
  // friendlyError writes the technical message to the server log; keep the test output quiet
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it("explains that the daily limit is reached", () => {
    expect(friendlyError(new Error("Daily Gemini limit reached (100 calls)"))).toBe(
      "Today's limit for AI calls is reached. Try again tomorrow.",
    );
  });

  it.each([
    "Request timeout",
    "The call timed out",
    "AbortError: aborted",
    "DEADLINE_EXCEEDED",
    "got status 504",
  ])("explains a slow Gemini for %j", (message) => {
    expect(friendlyError(new Error(message))).toBe("Gemini didn't answer in time. Try again in a moment.");
  });

  it("explains that the usage counter can't be reached", () => {
    expect(
      friendlyError(new Error("Could not check the daily Gemini limit, so no call was made: ECONNREFUSED")),
    ).toBe("The AI is paused because the usage counter can't be reached.");
  });

  // The counter error carries the database's own message, which can say "timeout" too
  it("still explains the usage counter when the database error mentions a timeout", () => {
    const message = "Could not check the daily Gemini limit, so no call was made: connection timeout";
    expect(friendlyError(new Error(message))).toBe(
      "The AI is paused because the usage counter can't be reached.",
    );
  });

  it("gives a general message for anything else", () => {
    expect(friendlyError(new Error("boom"))).toBe("Something went wrong while answering. Try again.");
  });

  it("handles things that are not Error objects", () => {
    expect(friendlyError("Request timeout")).toBe("Gemini didn't answer in time. Try again in a moment.");
    expect(friendlyError(undefined)).toBe("Something went wrong while answering. Try again.");
  });

  it("writes the technical message to the server log, not to the visitor", () => {
    const shown = friendlyError(new Error("secret internal detail"));
    expect(log).toHaveBeenCalledWith("[ask]", "secret internal detail");
    expect(shown).not.toContain("secret");
  });
});
