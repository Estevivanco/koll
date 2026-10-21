import pg from "pg";
import type { Transaction } from "@koll/shared";

// Without this, pg quietly falls back to defaults and talks to whatever is on localhost
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run with: npx tsx --env-file=.env ...");
}

// A pool is a small group of open phone lines to the database, reused between queries
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Safe to run every time: only creates the table if it isn't there yet
export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id           text PRIMARY KEY,
      date         date NOT NULL,
      amount       numeric(12, 2) NOT NULL,
      counterparty text NOT NULL,
      description  text NOT NULL,
      source       text NOT NULL,
      category     text
    )
  `);
}

// Returns how many rows were new. Rows whose id already exists are skipped, so
// importing the same file twice never creates duplicates.
export async function saveTransactions(transactions: Transaction[]): Promise<number> {
  // unnest turns one array per column into rows, so all inserts go in a single query
  const result = await pool.query(
    `INSERT INTO transactions (id, date, amount, counterparty, description, source)
     SELECT * FROM unnest($1::text[], $2::date[], $3::numeric[], $4::text[], $5::text[], $6::text[])
     ON CONFLICT (id) DO NOTHING`,
    [
      transactions.map((t) => t.id),
      transactions.map((t) => t.date),
      transactions.map((t) => t.amount),
      transactions.map((t) => t.counterparty),
      transactions.map((t) => t.description),
      transactions.map((t) => t.source),
    ],
  );
  return result.rowCount ?? 0;
}
