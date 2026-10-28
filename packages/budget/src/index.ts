import pg from "pg";

// Max Gemini calls per day, counted across ALL agents and scripts (also evals).
// Change it with GEMINI_DAILY_LIMIT in .env.
const DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT ?? 100);

let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
  const url = process.env.BUDGET_DATABASE_URL;
  if (!url) {
    throw new Error("BUDGET_DATABASE_URL is not set. Run with: npx tsx --env-file=.env ...");
  }
  // allowExitOnIdle: a short script can finish without waiting for this connection to time out
  pool ??= new pg.Pool({ connectionString: url, max: 2, allowExitOnIdle: true });
  return pool;
}

// Call this right BEFORE every Gemini call. It adds 1 to today's counter, or throws
// once the limit is reached. If the counter can't be checked, it also throws:
// when in doubt, don't spend.
export async function reserveGeminiCall(): Promise<void> {
  let used: number | undefined;
  try {
    // One atomic statement: add 1 only while today's total is under the limit.
    // Two agents calling at the same moment can't both squeeze past the last slot.
    const { rows } = await getPool().query(
      `INSERT INTO gemini_usage (day, calls)
       VALUES ((now() AT TIME ZONE 'Europe/Stockholm')::date, 1)
       ON CONFLICT (day) DO UPDATE SET calls = gemini_usage.calls + 1
         WHERE gemini_usage.calls < $1
       RETURNING calls`,
      [DAILY_LIMIT],
    );
    used = rows[0]?.calls;
  } catch (error) {
    throw new Error(
      `Could not check the daily Gemini limit, so no call was made: ${(error as Error).message}`,
      {
        cause: error,
      },
    );
  }

  if (used === undefined) {
    throw new Error(
      `Daily Gemini limit reached (${DAILY_LIMIT} calls). It resets at midnight (Swedish time). ` +
        `To allow more today, raise GEMINI_DAILY_LIMIT in .env.`,
    );
  }
}
