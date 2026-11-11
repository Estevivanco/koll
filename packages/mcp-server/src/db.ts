import pg from "pg";

if (!process.env.ANALYST_DATABASE_URL) {
  // Thrown, not process.exit: the error goes to stderr and the process still stops with an error,
  // but importing this file in a test can't kill the test runner. (Never stdout: it is reserved for MCP messages.)
  throw new Error("ANALYST_DATABASE_URL is not set. Pass --env-file with the full path to .env");
}

// Same read-only login as the analyst: the MCP server can look, never change
export const pool = new pg.Pool({ connectionString: process.env.ANALYST_DATABASE_URL });

export async function query(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}
