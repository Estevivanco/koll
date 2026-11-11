import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { resolve } from "node:path";

/*
  Runs ONCE before all integration tests: starts a throwaway Postgres in Docker, builds it from the
  real db/init/ scripts (so analyst_ro and budget_rw are made exactly like in production), creates the
  tables, and points the three DATABASE_URLs at it. The container is removed when the run ends.

  The URLs are always overwritten here, so a test can never reach the real database, whatever .env says.
*/

// Made-up passwords for a database that only lives for one test run
const OWNER = { user: "koll_owner", password: "owner-pw", database: "koll_test" };
const ANALYST_PASSWORD = "analyst-pw";
const BUDGET_PASSWORD = "budget-pw";

export default async function setup() {
  const container = await new PostgreSqlContainer("postgres:17")
    .withDatabase(OWNER.database)
    .withUsername(OWNER.user)
    .withPassword(OWNER.password)
    // The init scripts read these two, like they do from .env in docker-compose
    .withEnvironment({ ANALYST_DB_PASSWORD: ANALYST_PASSWORD, BUDGET_DB_PASSWORD: BUDGET_PASSWORD })
    // Postgres runs everything in this folder once, when the database is first created
    .withCopyDirectoriesToContainer([
      { source: resolve(import.meta.dirname, "../../db/init"), target: "/docker-entrypoint-initdb.d" },
    ])
    .start();

  const host = container.getHost();
  const port = container.getPort();
  const url = (user: string, password: string) =>
    `postgres://${user}:${password}@${host}:${port}/${OWNER.database}`;

  // These are read when a db.ts file is first imported, so they must be set before any test runs
  process.env.DATABASE_URL = url(OWNER.user, OWNER.password);
  process.env.ANALYST_DATABASE_URL = url("analyst_ro", ANALYST_PASSWORD);
  process.env.BUDGET_DATABASE_URL = url("budget_rw", BUDGET_PASSWORD);

  // The importer creates the transactions table in production, so use its real function here too
  const { ensureSchema, pool } = await import("../../packages/importer/src/db.js");
  await ensureSchema();
  await pool.end();

  return async () => {
    await container.stop();
  };
}
