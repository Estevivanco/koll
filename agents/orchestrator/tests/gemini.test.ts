import { describe, expect, it } from "vitest";
import { parseRoute } from "../src/gemini.js";

const names = ["Koll Categorizer", "Koll Analyst"];

describe("parseRoute", () => {
  it("returns the route the model chose", () => {
    const text = JSON.stringify({
      agent: "Koll Analyst",
      message: "Hur mycket på mat?",
      reason: "A spending question.",
    });
    expect(parseRoute(text, names, "original")).toEqual({
      agent: "Koll Analyst",
      message: "Hur mycket på mat?",
      reason: "A spending question.",
    });
  });

  it("turns an unknown agent name into none", () => {
    const text = JSON.stringify({ agent: "Koll Poet", message: "m", reason: "r" });
    expect(parseRoute(text, names, "original").agent).toBe("none");
  });

  it("keeps none when the model says none", () => {
    const text = JSON.stringify({ agent: "none", message: "m", reason: "No agent fits." });
    expect(parseRoute(text, names, "original").agent).toBe("none");
  });

  it("uses the original request when the message is empty or missing", () => {
    expect(parseRoute('{"agent":"Koll Analyst","message":"","reason":"r"}', names, "min fråga").message).toBe(
      "min fråga",
    );
    expect(parseRoute('{"agent":"Koll Analyst","reason":"r"}', names, "min fråga").message).toBe("min fråga");
  });

  it("uses an empty reason when it is missing", () => {
    expect(parseRoute('{"agent":"Koll Analyst","message":"m"}', names, "x").reason).toBe("");
  });

  it("falls back to none with the original request when there is no answer", () => {
    expect(parseRoute(undefined, names, "min fråga")).toEqual({
      agent: "none",
      message: "min fråga",
      reason: "",
    });
  });

  it("throws when the answer is not JSON", () => {
    expect(() => parseRoute("Koll Analyst", names, "x")).toThrow();
  });
});
