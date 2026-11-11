import pg from "pg";

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
