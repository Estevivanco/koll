import { describe, expect, it } from "vitest";
import { LAST_FULL_MONTH, MONTHS, PREVIOUS_MONTH, TREND, totalSpent, type MonthDetail } from "./demo";

describe("totalSpent", () => {
  it("adds up the categories", () => {
    const month: MonthDetail = {
      ...MONTHS[0],
      categories: [
        { category: "Mat", spent: 100, count: 1 },
        { category: "Boende", spent: 250, count: 1 },
      ],
    };
    expect(totalSpent(month)).toBe(350);
  });

  it("is 0 for a month with no categories", () => {
    expect(totalSpent({ ...MONTHS[0], categories: [] })).toBe(0);
  });
});

// The website shows these numbers side by side, so they have to agree with each other
describe("demo data", () => {
  it.each(MONTHS.map((m) => [m.label, m] as const))(
    "%s: the category counts add up to the transaction count",
    (_label, month) => {
      expect(month.categories.reduce((sum, c) => sum + c.count, 0)).toBe(month.transactions);
    },
  );

  it("has a trend point for every month, with the same totals", () => {
    for (const month of MONTHS) {
      expect(TREND.find((point) => point.id === month.id)?.spent).toBe(totalSpent(month));
    }
  });

  it("has a trend with the oldest month first", () => {
    const ids = TREND.map((point) => point.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("shows a finished month in the hero, after the one before it", () => {
    expect(LAST_FULL_MONTH.partial).toBe(false);
    expect(PREVIOUS_MONTH.id < LAST_FULL_MONTH.id).toBe(true);
  });
});
