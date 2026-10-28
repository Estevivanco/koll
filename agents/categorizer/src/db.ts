import pg from "pg";
import type { Transaction } from "@koll/shared";
import type { CategoryResult } from "./provider.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run with: npx tsx --env-file=.env ...");
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function getUncategorized(limit: number): Promise<Transaction[]> {
  const { rows } = await pool.query(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, amount, counterparty, description, source
     FROM transactions
     WHERE category IS NULL
     ORDER BY date DESC
     LIMIT $1`,
    [limit],
  );
  // pg returns numeric columns as strings ("-125.00"), so convert
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}

export async function saveCategories(results: CategoryResult[]): Promise<void> {
  await pool.query(
    `UPDATE transactions AS t
     SET category = r.category
     FROM unnest($1::text[], $2::text[]) AS r(id, category)
     WHERE t.id = r.id`,
    [results.map((r) => r.id), results.map((r) => r.category)],
  );
}
