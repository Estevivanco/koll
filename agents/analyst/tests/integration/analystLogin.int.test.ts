import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { seedTransactions } from "../../../../tests/integration/helpers.js";

// The analyst_ro login itself, used directly: not through runReadOnly and its checks.
// This is the last line of defence. If every check in the code failed, this login still can't change anything.
const analyst = new pg.Pool({ connectionString: process.env.ANALYST_DATABASE_URL, max: 2 });

afterAll(() => analyst.end());

const DENIED = /permission denied|read-only transaction/i;

describe("the analyst_ro login", () => {
  it("can read transactions", async () => {
    await seedTransactions(2);
    const { rows } = await analyst.query("SELECT count(*)::int AS n FROM transactions");
    expect(rows[0].n).toBe(2);
  });

  describe("cannot change anything, even without runReadOnly", () => {
    it.each([
      ["INSERT", "INSERT INTO transactions VALUES ('x', '2026-10-01', 1, 'X', '', 'swedbank')"],
      ["UPDATE", "UPDATE transactions SET amount = 0"],
      ["DELETE", "DELETE FROM transactions"],
      ["TRUNCATE", "TRUNCATE transactions"],
      ["DROP TABLE", "DROP TABLE transactions"],
      ["ALTER TABLE", "ALTER TABLE transactions ADD COLUMN spy text"],
      ["CREATE TABLE", "CREATE TABLE spy (x int)"],
      ["CREATE ROLE", "CREATE ROLE intruder LOGIN"],
    ])("%s is refused", async (_name, sql) => {
      await seedTransactions(1);

      await expect(analyst.query(sql)).rejects.toThrow(
        /permission denied|read-only transaction|must be owner/i,
      );

      const { rows } = await analyst.query("SELECT count(*)::int AS n FROM transactions");
      expect(rows[0].n).toBe(1);
    });

    it("is still refused after turning the read-only setting off", async () => {
      await seedTransactions(1);
      const client = await analyst.connect();
      try {
        await client.query("SET default_transaction_read_only = off");
        await expect(client.query("DELETE FROM transactions")).rejects.toThrow(DENIED);
      } finally {
        client.release();
      }
    });
  });

  // The login can read every table, not only transactions: gemini_usage too. Harmless (it is only a counter),
  // but it is more than the analyst needs. If you narrow it in db/init/01-analyst-role.sh, change this test.
  it("can also read the gemini_usage counter", async () => {
    await expect(analyst.query("SELECT * FROM gemini_usage")).resolves.toBeDefined();
  });

  it("cannot write to the gemini_usage counter", async () => {
    await expect(analyst.query("INSERT INTO gemini_usage VALUES ('2026-10-01', 99)")).rejects.toThrow(DENIED);
  });
});
