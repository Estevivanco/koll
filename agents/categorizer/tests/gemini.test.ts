import { describe, expect, it } from "vitest";
import { parseCategories } from "../src/gemini.js";

describe("parseCategories", () => {
  it("keeps categories that are on the list", () => {
    expect(parseCategories('[{"id":"a","category":"Mat"},{"id":"b","category":"Nöje"}]')).toEqual([
      { id: "a", category: "Mat" },
      { id: "b", category: "Nöje" },
    ]);
  });

  it("turns a category outside the list into Övrigt", () => {
    expect(parseCategories('[{"id":"a","category":"Husdjur"}]')).toEqual([{ id: "a", category: "Övrigt" }]);
  });

  it("is strict about spelling and case", () => {
    expect(parseCategories('[{"id":"a","category":"mat"},{"id":"b","category":"Mat "}]')).toEqual([
      { id: "a", category: "Övrigt" },
      { id: "b", category: "Övrigt" },
    ]);
  });

  it("gives nothing back for an empty answer", () => {
    expect(parseCategories("[]")).toEqual([]);
    expect(parseCategories(undefined)).toEqual([]);
  });

  it("throws when the answer is not JSON", () => {
    expect(() => parseCategories("Mat")).toThrow();
  });
});
