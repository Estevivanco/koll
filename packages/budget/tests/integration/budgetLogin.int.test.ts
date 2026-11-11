import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { admin, seedTransactions } from "../../../../tests/integration/helpers.js";

// The budget_rw login itself, used directly. It exists so that a bug or a stolen password
// in an agent can't wipe the counter, read your transactions or change anything else.
const budget = new pg.Pool({ connectionString: process.env.BUDGET_DATABASE_URL, max: 2 });

afterAll(() => budget.end());

const DENIED = /permission denied/i;

describe("the budget_rw login", () => {
  describe("can use the counter", () => {
    it("can add a day and read it back", async () => {
      await budget.query("INSERT INTO gemini_usage VALUES ('2026-10-01', 1)");
      const { rows } = await budget.query("SELECT calls FROM gemini_usage WHERE day = '2026-10-01'");
      expect(rows[0].calls).toBe(1);
    });

    it("can count up", async () => {
      await budget.query("INSERT INTO gemini_usage VALUES ('2026-10-01', 1)");
      await budget.query("UPDATE gemini_usage SET calls = calls + 1 WHERE day = '2026-10-01'");
      const { rows } = await admin.query("SELECT calls FROM gemini_usage");
      expect(rows[0].calls).toBe(2);
    });
  });

  describe("cannot wipe the counter", () => {
    it("is refused DELETE", async () => {
      await admin.query("INSERT INTO gemini_usage VALUES ('2026-10-01', 5)");

      await expect(budget.query("DELETE FROM gemini_usage")).rejects.toThrow(DENIED);

      expect((await admin.query("SELECT calls FROM gemini_usage")).rows[0].calls).toBe(5);
    });

    it("is refused TRUNCATE and DROP", async () => {
      await expect(budget.query("TRUNCATE gemini_usage")).rejects.toThrow(DENIED);
      await expect(budget.query("DROP TABLE gemini_usage")).rejects.toThrow(
        /must be owner|permission denied/i,
      );
    });
  });

  describe("cannot touch anything else", () => {
    it("cannot read transactions", async () => {
      await seedTransactions(1);
      await expect(budget.query("SELECT * FROM transactions")).rejects.toThrow(DENIED);
    });

    it("cannot change transactions", async () => {
      await seedTransactions(1);

      await expect(budget.query("DELETE FROM transactions")).rejects.toThrow(DENIED);
      await expect(budget.query("UPDATE transactions SET amount = 0")).rejects.toThrow(DENIED);

      expect((await admin.query("SELECT count(*)::int AS n FROM transactions")).rows[0].n).toBe(1);
    });

    it("cannot create tables", async () => {
      await expect(budget.query("CREATE TABLE spy (x int)")).rejects.toThrow(DENIED);
    });
  });
});
