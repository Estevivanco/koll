import { describe, expect, it } from "vitest";
import { parseSql } from "../src/gemini.js";

describe("parseSql", () => {
  it("returns the SQL from the model's JSON", () => {
    expect(parseSql('{"sql":"SELECT 1"}')).toBe("SELECT 1");
  });

  it("throws when the model gave no SQL", () => {
    expect(() => parseSql("{}")).toThrow("The model returned no SQL");
    expect(() => parseSql('{"sql":""}')).toThrow("The model returned no SQL");
  });

  it("throws when the model gave no text at all", () => {
    expect(() => parseSql(undefined)).toThrow("The model returned no SQL");
  });

  it("throws when the answer is not JSON", () => {
    expect(() => parseSql("SELECT 1")).toThrow();
  });
});
