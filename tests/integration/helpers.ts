import type { Transaction } from "@koll/shared";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { parseSwedbank } from "../../packages/importer/src/swedbank.js";

// The owner login: for putting test data in and checking what is in the database.
// The logins that are being tested (analyst_ro, budget_rw) are used through the real code or their own URLs.
// setup.ts closes this pool after each test file, so tests must not.
export const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

// Puts n made-up transactions in the database (one per day in October 2026 would be too few, so ids are numbered)
export async function seedTransactions(n: number): Promise<void> {
  await admin.query(
    `INSERT INTO transactions (id, date, amount, counterparty, description, source)
     SELECT 'seed-' || g, DATE '2026-10-01', -g, 'SEED ' || g, '', 'swedbank' FROM generate_series(1, $1::int) AS g`,
    [n],
  );
}

export async function countRows(table: "transactions" | "gemini_usage"): Promise<number> {
  const { rows } = await admin.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

// ---- The made-up bank export (see tests/fixtures/README.md for what is in it) ----

export const FIXTURE_PATH = resolve(import.meta.dirname, "../fixtures/swedbank-sample.csv");

// The fixture as transactions, read with the real importer parser
export function readFixture(): Transaction[] {
  return parseSwedbank(readFileSync(FIXTURE_PATH, "utf8"));
}

// Puts the fixture in the database (all uncategorized), without going through the code that is being tested
export async function loadFixture(): Promise<Transaction[]> {
  const transactions = readFixture();
  await admin.query(
    `INSERT INTO transactions (id, date, amount, counterparty, description, source)
     SELECT * FROM unnest($1::text[], $2::date[], $3::numeric[], $4::text[], $5::text[], $6::text[])`,
    [
      transactions.map((t) => t.id),
      transactions.map((t) => t.date),
      transactions.map((t) => t.amount),
      transactions.map((t) => t.counterparty),
      transactions.map((t) => t.description),
      transactions.map((t) => t.source),
    ],
  );
  return transactions;
}
