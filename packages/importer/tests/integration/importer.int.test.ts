import { afterAll, describe, expect, it } from "vitest";
import { admin, countRows, readFixture } from "../../../../tests/integration/helpers.js";
import { ensureSchema, pool, saveTransactions } from "../../src/db.js";

// The importer's path into the database: fixture CSV -> parseSwedbank -> saveTransactions -> Postgres.

afterAll(() => pool.end());

describe("saveTransactions", () => {
  it("saves every row of the fixture", async () => {
    const inserted = await saveTransactions(readFixture());

    expect(inserted).toBe(20);
    expect(await countRows("transactions")).toBe(20);
  });

  it("saves nothing new when the same file is imported again", async () => {
    await saveTransactions(readFixture());

    expect(await saveTransactions(readFixture())).toBe(0);
    expect(await countRows("transactions")).toBe(20);
  });

  it("only saves the new rows when a file overlaps an earlier import", async () => {
    const all = readFixture();
    await saveTransactions(all.slice(0, 12));

    expect(await saveTransactions(all)).toBe(8);
    expect(await countRows("transactions")).toBe(20);
  });

  it("handles an empty file", async () => {
    expect(await saveTransactions([])).toBe(0);
  });

  describe("what ends up in the table", () => {
    it("stores amounts exactly (no rounding drift)", async () => {
      await saveTransactions(readFixture());

      const { rows } = await admin.query(
        "SELECT SUM(amount)::text AS net, -SUM(amount) FILTER (WHERE amount < 0) AS spent FROM transactions",
      );

      // 73 500 kr in, 9 867,25 kr out (see tests/fixtures/README.md)
      expect(rows[0].net).toBe("63632.75");
      expect(Number(rows[0].spent)).toBe(9867.25);
    });

    it("stores a thousands-spaced amount correctly (-1 234,50)", async () => {
      await saveTransactions(readFixture());

      const { rows } = await admin.query("SELECT amount::text FROM transactions WHERE date = '2026-09-19'");

      expect(rows).toEqual([{ amount: "-1234.50" }]);
    });

    it("stores å, ä and ö correctly, with no � left", async () => {
      await saveTransactions(readFixture());

      const { rows } = await admin.query(
        "SELECT DISTINCT counterparty, description FROM transactions WHERE counterparty IN ('Lön', 'Sparkonto', 'ICA MAXI')",
      );
      const text = rows.map((r) => `${r.counterparty}/${r.description}`).sort();

      expect(text).toEqual(["ICA MAXI/Kortköp", "Lön/Lön", "Sparkonto/Överföring"]);
      const broken = await admin.query(
        "SELECT count(*)::int AS n FROM transactions WHERE counterparty LIKE '%�%' OR description LIKE '%�%'",
      );
      expect(broken.rows[0].n).toBe(0);
    });

    it("stores the date as a date and the source as swedbank, with no category yet", async () => {
      await saveTransactions(readFixture());

      const { rows } = await admin.query(
        "SELECT to_char(date, 'YYYY-MM-DD') AS d, source, category FROM transactions WHERE amount = 24500 ORDER BY date",
      );

      expect(rows).toEqual([
        { d: "2026-08-25", source: "swedbank", category: null },
        { d: "2026-09-25", source: "swedbank", category: null },
        { d: "2026-10-25", source: "swedbank", category: null },
      ]);
    });
  });
});

describe("ensureSchema", () => {
  it("can run again without error and keeps the data", async () => {
    await saveTransactions(readFixture());

    await ensureSchema();
    await ensureSchema();

    expect(await countRows("transactions")).toBe(20);
  });
});
