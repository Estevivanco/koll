import { categorizeBatch } from "./categorize.js";
import { pool } from "./db.js";

const limit = Number(process.argv[2] ?? 50);

try {
  const summary = await categorizeBatch(limit);
  if (summary.total === 0) {
    console.log("Nothing left to categorize");
  } else {
    console.log(`${summary.fromRules} by rules, ${summary.fromAi} by AI`);
    console.table(summary.rows);
  }
} finally {
  await pool.end();
}