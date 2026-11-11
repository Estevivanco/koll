import { afterAll, describe, expect, it, vi } from "vitest";
import { admin, countRows, seedTransactions } from "../../../../tests/integration/helpers.js";
import { pool, runReadOnly } from "../../src/db.js";

// runReadOnly runs SQL that an AI wrote, so it must never change or leak anything.
// Its layers: the text check (unit tests), the SELECT * FROM (...) wrapper, a READ ONLY transaction, a 5 s limit,
// a 200 row limit, and the analyst_ro login that can only read. These tests use them together, on a real Postgres.

afterAll(() => pool.end());

describe("runReadOnly", () => {
  it("returns the rows of a SELECT", async () => {
    await seedTransactions(3);

    const rows = await runReadOnly("SELECT id FROM transactions ORDER BY id");

    expect(rows.map((r) => r.id)).toEqual(["seed-1", "seed-2", "seed-3"]);
  });

  it("accepts a trailing semicolon and a WITH query", async () => {
    await seedTransactions(2);

    expect(await runReadOnly("SELECT 1 AS x;")).toEqual([{ x: 1 }]);
    expect(
      await runReadOnly("WITH t AS (SELECT count(*)::int AS n FROM transactions) SELECT n FROM t"),
    ).toEqual([{ n: 2 }]);
  });

  it("returns at most 200 rows, however many match", async () => {
    await seedTransactions(500);

    const rows = await runReadOnly("SELECT * FROM transactions");

    expect(rows).toHaveLength(200);
  });

  describe("changes are refused by Postgres, and nothing is left changed", () => {
    // The text check lets WITH through. Postgres says no: the wrapper makes a data-changing WITH a syntax error
    it("refuses a DELETE hidden inside a WITH query", async () => {
      await seedTransactions(3);

      await expect(
        runReadOnly("WITH gone AS (DELETE FROM transactions RETURNING *) SELECT * FROM gone"),
      ).rejects.toThrow(/data-modifying|read-only|permission denied/i);

      expect(await countRows("transactions")).toBe(3);
    });

    it("refuses an UPDATE hidden inside a WITH query", async () => {
      await seedTransactions(1);

      await expect(
        runReadOnly("WITH changed AS (UPDATE transactions SET amount = 0 RETURNING *) SELECT * FROM changed"),
      ).rejects.toThrow(/data-modifying|read-only|permission denied/i);

      const rows = await runReadOnly("SELECT amount FROM transactions");
      expect(Number(rows[0].amount)).toBe(-1);
    });

    it("refuses an INSERT hidden inside a WITH query", async () => {
      await expect(
        runReadOnly(
          "WITH added AS (INSERT INTO transactions VALUES ('x', '2026-10-01', 1, 'X', '', 'swedbank') RETURNING *) SELECT * FROM added",
        ),
      ).rejects.toThrow(/data-modifying|read-only|permission denied/i);

      expect(await countRows("transactions")).toBe(0);
    });

    // The wrapper can't catch this one: it is a plain SELECT. Here the READ ONLY transaction (and the login) are what stop it.
    it("refuses a function that deletes data, called from a plain SELECT", async () => {
      await seedTransactions(3);
      await admin.query(
        "CREATE OR REPLACE FUNCTION wipe_transactions() RETURNS int LANGUAGE sql AS 'WITH d AS (DELETE FROM transactions RETURNING 1) SELECT count(*)::int FROM d'",
      );
      try {
        await expect(runReadOnly("SELECT wipe_transactions()")).rejects.toThrow(
          /read-only|permission denied/i,
        );
        expect(await countRows("transactions")).toBe(3);
      } finally {
        await admin.query("DROP FUNCTION wipe_transactions()");
      }
    });
  });

  describe("limits", () => {
    it("stops a query that takes longer than 5 seconds", async () => {
      const started = Date.now();

      await expect(runReadOnly("SELECT pg_sleep(6)")).rejects.toThrow(/statement timeout/i);

      const seconds = (Date.now() - started) / 1000;
      expect(seconds).toBeGreaterThanOrEqual(4.5);
      expect(seconds).toBeLessThan(6);
    }, 15_000);
  });

  describe("connections", () => {
    // analyst_ro may have 5 connections. If a failed query kept its connection, the 6th call would fail.
    it("gives the connection back after a failed query", async () => {
      await seedTransactions(1);

      for (let i = 0; i < 8; i++) {
        await expect(
          runReadOnly("WITH g AS (DELETE FROM transactions RETURNING *) SELECT * FROM g"),
        ).rejects.toThrow();
      }

      expect(await runReadOnly("SELECT count(*)::int AS n FROM transactions")).toEqual([{ n: 1 }]);
    });

    it("rolls back, so a refused query leaves no open transaction behind", async () => {
      await seedTransactions(1);
      await expect(runReadOnly("SELECT 1/0")).rejects.toThrow(/division by zero/i);

      // The same pooled connection is reused. If it were still inside the failed transaction, this would fail.
      expect(await runReadOnly("SELECT 1 AS ok")).toEqual([{ ok: 1 }]);
    });
  });
});

// Each layer on its own. Here runReadOnly gets a login that CAN write (the owner), so the only thing
// left between an AI's SQL and your data is the READ ONLY transaction. It must hold by itself.
describe("runReadOnly with a login that can write (only the READ ONLY transaction is left)", () => {
  it("still refuses a function that deletes data", async () => {
    vi.resetModules();
    vi.stubEnv("ANALYST_DATABASE_URL", process.env.DATABASE_URL!);
    const owner = await import("../../src/db.js");
    await seedTransactions(3);
    await admin.query(
      "CREATE OR REPLACE FUNCTION wipe_transactions() RETURNS int LANGUAGE sql AS 'WITH d AS (DELETE FROM transactions RETURNING 1) SELECT count(*)::int FROM d'",
    );
    try {
      await expect(owner.runReadOnly("SELECT wipe_transactions()")).rejects.toThrow(/read-only transaction/i);
      expect(await countRows("transactions")).toBe(3);
    } finally {
      await admin.query("DROP FUNCTION wipe_transactions()");
      await owner.pool.end();
      vi.unstubAllEnvs();
    }
  });
});
