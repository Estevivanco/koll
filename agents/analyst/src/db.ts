import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run with: npx tsx --env-file=.env ...");
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const MAX_ROWS = 200;

// Runs AI-written SQL as safely as we can:
// 1. Only one statement, and it must start with SELECT or WITH.
// 2. Inside a READ ONLY transaction, so Postgres itself refuses any change.
// 3. With a 5 second time limit, so a bad query can't hang the agent.
// 4. With a row limit, so a huge result can't flood the AI.
export async function runReadOnly(sql: string): Promise<Record<string, unknown>[]> {
  const cleaned = sql.trim().replace(/;\s*$/, "");
  if (cleaned.includes(";")) throw new Error("Only one SQL statement is allowed");
  if (!/^(select|with)\b/i.test(cleaned)) throw new Error("Only SELECT queries are allowed");

  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = 5000");
    const result = await client.query(`SELECT * FROM (${cleaned}) AS answer LIMIT ${MAX_ROWS}`);
    return result.rows;
  } finally {
    // ROLLBACK, never COMMIT: nothing should ever be saved from here
    await client.query("ROLLBACK");
    client.release();
  }
}