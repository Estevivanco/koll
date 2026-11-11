import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { admin, loadFixture } from "../../../../tests/integration/helpers.js";
import { categorizeBatch } from "../../src/categorize.js";
import { getUncategorized, pool, saveCategories } from "../../src/db.js";
import { createGeminiProvider } from "../../src/gemini.js";

// The real database, but never the real AI
vi.mock("../../src/gemini.js", () => ({ createGeminiProvider: vi.fn() }));

afterAll(() => pool.end());

async function categoryOf(counterparty: string): Promise<(string | null)[]> {
  const { rows } = await admin.query(
    "SELECT category FROM transactions WHERE counterparty = $1 ORDER BY date",
    [counterparty],
  );
  return rows.map((r) => r.category);
}

describe("getUncategorized", () => {
  beforeEach(async () => {
    await loadFixture();
  });

  it("returns transactions in the shape the categorizer needs, with the amount as a number", async () => {
    const [newest] = await getUncategorized(1);

    expect(newest).toEqual({
      id: expect.any(String),
      date: "2026-10-28",
      amount: -2000,
      counterparty: "Sparkonto",
      description: "Överföring",
      source: "swedbank",
    });
    expect(typeof newest.amount).toBe("number");
  });

  it("returns newest first", async () => {
    const dates = (await getUncategorized(20)).map((t) => t.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("respects the limit", async () => {
    expect(await getUncategorized(5)).toHaveLength(5);
    expect(await getUncategorized(100)).toHaveLength(20);
  });

  it("skips transactions that already have a category", async () => {
    await admin.query("UPDATE transactions SET category = 'Mat' WHERE counterparty = 'ICA MAXI'");

    const left = await getUncategorized(100);

    expect(left).toHaveLength(15);
    expect(left.some((t) => t.counterparty === "ICA MAXI")).toBe(false);
  });
});

describe("saveCategories", () => {
  beforeEach(async () => {
    await loadFixture();
  });

  it("saves each category on the right transaction and leaves the others alone", async () => {
    const [spotify] = (
      await admin.query("SELECT id FROM transactions WHERE counterparty = 'SPOTIFY' LIMIT 1")
    ).rows;
    const [csn] = (await admin.query("SELECT id FROM transactions WHERE counterparty = 'PRESSBYRAN'")).rows;

    await saveCategories([
      { id: spotify.id, category: "Prenumeration" },
      { id: csn.id, category: "Tobak" },
    ]);

    const { rows } = await admin.query(
      "SELECT id, category FROM transactions WHERE category IS NOT NULL ORDER BY id",
    );
    expect(rows).toEqual(
      [
        { id: spotify.id, category: "Prenumeration" },
        { id: csn.id, category: "Tobak" },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("ignores an id that does not exist", async () => {
    await saveCategories([{ id: "no-such-id", category: "Mat" }]);

    const { rows } = await admin.query(
      "SELECT count(*)::int AS n FROM transactions WHERE category IS NOT NULL",
    );
    expect(rows[0].n).toBe(0);
  });

  it("does nothing for an empty list", async () => {
    await expect(saveCategories([])).resolves.toBeUndefined();
  });
});

describe("categorizeBatch against the real database", () => {
  // The fake AI: it only ever sees what the rules did not match
  const ask = vi.fn(async (transactions: { id: string; counterparty: string }[]) =>
    transactions.map((t) => ({
      id: t.id,
      category:
        ({ "ICA MAXI": "Mat", SPOTIFY: "Prenumeration", Sparkonto: "Överföring" } as Record<string, string>)[
          t.counterparty
        ] ?? "Övrigt",
    })),
  );

  beforeEach(async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.mocked(createGeminiProvider).mockReturnValue({ categorize: ask as never });
    ask.mockClear();
    await loadFixture();
  });

  it("saves rule results and AI results, and nothing is left uncategorized", async () => {
    const summary = await categorizeBatch(100);

    // Rules: Lön 3 + Espresso House 3 + Circle K 2 + Pressbyrån 1. AI: ICA 5 + Spotify 3 + Sparkonto 3.
    expect(summary).toMatchObject({ total: 20, fromRules: 9, fromAi: 11 });
    expect(ask.mock.calls[0][0]).toHaveLength(11);

    expect(await categoryOf("Lön")).toEqual(["Lön", "Lön", "Lön"]);
    expect(await categoryOf("ESPRESSO HOUSE")).toEqual(["Restaurang", "Restaurang", "Restaurang"]);
    expect(await categoryOf("CIRCLE K")).toEqual(["Tobak", "Transport"]); // 52 kr (snus), then 420 kr (rented car)
    expect(await categoryOf("PRESSBYRAN")).toEqual(["Tobak"]);
    expect(await categoryOf("ICA MAXI")).toEqual(["Mat", "Mat", "Mat", "Mat", "Mat"]);
    expect(await categoryOf("SPOTIFY")).toEqual(["Prenumeration", "Prenumeration", "Prenumeration"]);
    expect(await categoryOf("Sparkonto")).toEqual(["Överföring", "Överföring", "Överföring"]);
    expect(await getUncategorized(100)).toEqual([]);
  });

  it("only takes the newest rows when asked for fewer", async () => {
    const summary = await categorizeBatch(5);

    expect(summary.total).toBe(5);
    expect((await getUncategorized(100)).length).toBe(15);
  });

  it("finds nothing to do the second time", async () => {
    await categorizeBatch(100);
    ask.mockClear();

    expect(await categorizeBatch(100)).toEqual({ total: 0, fromRules: 0, fromAi: 0, rows: [] });
    expect(ask).not.toHaveBeenCalled();
  });
});
