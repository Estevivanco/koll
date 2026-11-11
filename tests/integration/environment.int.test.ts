import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

/*
  Checks the test setup itself, so the other integration tests can trust it:
  the URLs point at the throwaway container, and the database was built from db/init/.
*/
const pools = [
  process.env.DATABASE_URL,
  process.env.ANALYST_DATABASE_URL,
  process.env.BUDGET_DATABASE_URL,
].map((connectionString) => new pg.Pool({ connectionString, max: 1 }));
const [owner, analyst, budget] = pools;

afterAll(() => Promise.all(pools.map((p) => p.end())));

describe("integration test database", () => {
  it("is the throwaway container, never a database from .env", () => {
    for (const name of ["DATABASE_URL", "ANALYST_DATABASE_URL", "BUDGET_DATABASE_URL"]) {
      const url = new URL(process.env[name]!);
      expect(url.pathname, name).toBe("/koll_test");
      expect(url.port, name).not.toBe("5432"); // the port docker-compose uses for your real database
    }
  });

  it("has the tables", async () => {
    const { rows } = await owner.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
    );
    expect(rows.map((r) => r.table_name)).toEqual(["gemini_usage", "transactions"]);
  });

  it("created the two limited logins from db/init/", async () => {
    const { rows } = await owner.query(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('analyst_ro', 'budget_rw') ORDER BY 1",
    );
    expect(rows.map((r) => r.rolname)).toEqual(["analyst_ro", "budget_rw"]);
  });

  it("lets each login in", async () => {
    expect((await analyst.query("SELECT current_user AS u")).rows[0].u).toBe("analyst_ro");
    expect((await budget.query("SELECT current_user AS u")).rows[0].u).toBe("budget_rw");
  });

  // Two steps in a row: the first leaves a row behind, the second proves setup.ts removed it
  it("(step 1) can write rows as the owner", async () => {
    await owner.query("INSERT INTO transactions VALUES ('t1', '2026-10-01', -10, 'TEST', '', 'swedbank')");
    await owner.query("INSERT INTO gemini_usage VALUES ('2026-10-01', 1)");
    expect((await owner.query("SELECT count(*)::int AS n FROM transactions")).rows[0].n).toBe(1);
  });

  it("(step 2) starts every test with empty tables", async () => {
    expect((await owner.query("SELECT count(*)::int AS n FROM transactions")).rows[0].n).toBe(0);
    expect((await owner.query("SELECT count(*)::int AS n FROM gemini_usage")).rows[0].n).toBe(0);
  });
});
