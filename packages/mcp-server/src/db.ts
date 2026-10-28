import pg from "pg";

if (!process.env.ANALYST_DATABASE_URL) {
  // console.error, never console.log: stdout is reserved for MCP messages (see index.ts)
  console.error("ANALYST_DATABASE_URL is not set. Pass --env-file with the full path to .env");
  process.exit(1);
}

// Same read-only login as the analyst: the MCP server can look, never change
export const pool = new pg.Pool({ connectionString: process.env.ANALYST_DATABASE_URL });

export async function query(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}
