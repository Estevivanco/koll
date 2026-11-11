import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { friendlyError } from "../src/friendly-error.js";

describe("friendlyError (the analyst's)", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => log.mockRestore());

  it("explains that the daily limit is reached, without the .env hint", () => {
    const text = friendlyError(
      new Error(
        "Daily Gemini limit reached (100 calls). It resets at midnight. Raise GEMINI_DAILY_LIMIT in .env.",
      ),
    );

    expect(text).toBe("Dagens gräns för AI-anrop är nådd. Försök igen imorgon.");
    expect(text).not.toMatch(/\.env|GEMINI_DAILY_LIMIT/);
  });

  it.each(["Request timeout", "The call timed out", "AbortError", "DEADLINE_EXCEEDED", "status 504"])(
    "explains a slow Gemini for %j",
    (message) => {
      expect(friendlyError(new Error(message))).toBe("Gemini svarade inte i tid. Försök igen om en stund.");
    },
  );

  it("explains that the usage counter can't be reached, even when the database error says timeout", () => {
    const message = "Could not check the daily Gemini limit, so no call was made: connection timeout";
    expect(friendlyError(new Error(message))).toBe(
      "AI:n är pausad eftersom användningsräknaren inte kan nås.",
    );
  });

  it.each([
    "connect ECONNREFUSED db:5432",
    'relation "secret_table" does not exist',
    "Only SELECT queries are allowed",
    "Permission denied on project koll-123456 in europe-north1",
  ])("gives a general message that leaks nothing for %j", (message) => {
    const text = friendlyError(new Error(message));

    expect(text).toBe("Jag kunde inte svara på den frågan. Försök igen.");
    expect(text).not.toContain(message);
  });

  it("handles things that are not Error objects", () => {
    expect(friendlyError("Request timeout")).toBe("Gemini svarade inte i tid. Försök igen om en stund.");
    expect(friendlyError(undefined)).toBe("Jag kunde inte svara på den frågan. Försök igen.");
  });

  it("writes the technical message to the server log", () => {
    friendlyError(new Error("connect ECONNREFUSED db:5432"));
    expect(log).toHaveBeenCalledWith("[analyst]", "connect ECONNREFUSED db:5432");
  });
});
