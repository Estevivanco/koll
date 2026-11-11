import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { admin, loadFixture } from "../../../../tests/integration/helpers.js";
import { pool } from "../../src/db.js";
import { monthlyTotals, recurringPayments, searchTransactions, spendingByCategory } from "../../src/tools.js";

// The MCP tools are fixed SQL run as the read-only analyst_ro login. The expected numbers come from the
// fixture (see tests/fixtures/README.md), so these tests check exact sums, not just "some rows came back".

afterAll(() => pool.end());

const CATEGORY_OF = {
  "ICA MAXI": "Mat",
  "ESPRESSO HOUSE": "Restaurang",
  SPOTIFY: "Prenumeration",
  "CIRCLE K": "Transport",
  PRESSBYRAN: "Tobak",
  Sparkonto: "Överföring",
  Lön: "Lön",
};

async function categorize() {
  for (const [counterparty, category] of Object.entries(CATEGORY_OF)) {
    await admin.query("UPDATE transactions SET category = $2 WHERE counterparty = $1", [
      counterparty,
      category,
    ]);
  }
}

beforeEach(async () => {
  await loadFixture();
});

describe("spendingByCategory", () => {
  it("adds up spending per category, biggest first (income is not spending)", async () => {
    await categorize();

    const rows = await spendingByCategory({});

    expect(rows.map((r) => [r.category, Number(r.spent_kr), r.purchases])).toEqual([
      ["Överföring", 6000, 3],
      ["Mat", 2782.25, 5],
      ["Transport", 472, 2],
      ["Prenumeration", 387, 3],
      ["Restaurang", 178, 3],
      ["Tobak", 48, 1],
    ]);
  });

  it("groups transactions without a category as Okategoriserad", async () => {
    const rows = await spendingByCategory({});

    expect(rows.map((r) => [r.category, Number(r.spent_kr), r.purchases])).toEqual([
      ["Okategoriserad", 9867.25, 17],
    ]);
  });

  it("limits to a period, including both end dates", async () => {
    await categorize();

    const september = await spendingByCategory({ from: "2026-09-01", to: "2026-09-30" });
    expect(september.reduce((sum, r) => sum + Number(r.spent_kr), 0)).toBe(3918.75);

    const oneDay = await spendingByCategory({ from: "2026-09-01", to: "2026-09-01" });
    expect(oneDay.map((r) => [r.category, Number(r.spent_kr)])).toEqual([["Prenumeration", 129]]);
  });

  it("returns nothing for a period without spending", async () => {
    expect(await spendingByCategory({ from: "2027-01-01" })).toEqual([]);
  });
});

describe("searchTransactions", () => {
  beforeEach(categorize);

  it("finds by text in the counterparty, ignoring case, newest first", async () => {
    const rows = await searchTransactions({ text: "ica" });

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.date)).toEqual([
      "2026-10-06",
      "2026-09-19",
      "2026-09-05",
      "2026-08-10",
      "2026-08-03",
    ]);
  });

  it("finds by text in the description too", async () => {
    const rows = await searchTransactions({ text: "autogiro" });

    expect(rows.map((r) => r.counterparty)).toEqual(["SPOTIFY", "SPOTIFY", "SPOTIFY"]);
  });

  it("filters by category and by period together", async () => {
    const rows = await searchTransactions({ category: "Mat", from: "2026-09-01", to: "2026-09-30" });

    expect(rows.map((r) => [r.date, Number(r.amount)])).toEqual([
      ["2026-09-19", -1234.5],
      ["2026-09-05", -445.25],
    ]);
  });

  it("returns 20 rows by default, and as many as the limit says", async () => {
    expect(await searchTransactions({})).toHaveLength(20);
    expect(await searchTransactions({ limit: 2 })).toHaveLength(2);
  });

  it("returns nothing when nothing matches", async () => {
    expect(await searchTransactions({ text: "finns-inte" })).toEqual([]);
  });

  it("treats the search text as text, never as SQL", async () => {
    expect(await searchTransactions({ text: "'; DROP TABLE transactions; --" })).toEqual([]);

    const { rows } = await admin.query("SELECT count(*)::int AS n FROM transactions");
    expect(rows[0].n).toBe(20);
  });
});

describe("monthlyTotals", () => {
  it("gives money in, money out and the difference per month, newest first", async () => {
    const rows = await monthlyTotals({});

    expect(rows.map((r) => [r.month, Number(r.income_kr), Number(r.spent_kr), Number(r.net_kr)])).toEqual([
      ["2026-10", 24500, 2908, 21592],
      ["2026-09", 24500, 3918.75, 20581.25],
      ["2026-08", 24500, 3040.5, 21459.5],
    ]);
  });

  it("limits the number of months, keeping the newest", async () => {
    const rows = await monthlyTotals({ months: 2 });

    expect(rows.map((r) => r.month)).toEqual(["2026-10", "2026-09"]);
  });
});

describe("recurringPayments", () => {
  // The rule is "charged in at least 3 different months", so it is not only subscriptions:
  // the weekly shop and the monthly transfer match too. Circle K (2 months) and Pressbyrån (1) do not.
  it("finds who charged in 3 or more different months", async () => {
    const rows = await recurringPayments();

    expect(
      rows.map((r) => [
        r.counterparty,
        r.months_charged,
        Number(r.average_kr),
        Number(r.highest_kr),
        r.last_charged,
      ]),
    ).toEqual([
      ["Sparkonto", 3, 2000, 2000, "2026-10-28"],
      ["ICA MAXI", 3, 556.45, 1234.5, "2026-10-06"],
      ["SPOTIFY", 3, 129, 129, "2026-10-01"],
      ["ESPRESSO HOUSE", 3, 59.33, 62, "2026-10-14"],
    ]);
  });

  it("does not count income", async () => {
    const rows = await recurringPayments();
    expect(rows.some((r) => r.counterparty === "Lön")).toBe(false);
  });
});
