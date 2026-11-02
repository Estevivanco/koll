import { mkdir, writeFile, access } from "node:fs/promises";
import { pool } from "../src/db.js";

// Makes a first draft of YOUR answer key for the categorizer eval, from your real transactions.
//   npm run eval:categorizer:prepare
// It picks up to 40 different merchants and writes them to data/evals/categorizer-cases.json
// (data/ is gitignored: your bank data never leaves your Mac).
//
// "expected" is pre-filled with the category each transaction has today, so you don't start
// from scratch. That is only a draft: check EVERY line and fix the ones that are wrong.
// If you just accept them, the eval measures the AI against itself.

const OUT = new URL("../../../data/evals/categorizer-cases.json", import.meta.url);
const HOW_MANY = Number(process.argv[2] ?? 40);

try {
  await access(OUT);
  console.error("data/evals/categorizer-cases.json already exists. Delete it first to make a new draft.");
  process.exit(1);
} catch {
  // Doesn't exist yet: good
}

try {
  // One transaction per merchant, in random order, so the answer key covers many different cases
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (counterparty)
              to_char(date, 'YYYY-MM-DD') AS date, counterparty, description, amount::float AS amount, category
       FROM transactions
       ORDER BY counterparty, random()
     ) AS one_per_merchant
     ORDER BY random()
     LIMIT $1`,
    [HOW_MANY],
  );

  const cases = rows.map((r) => ({
    date: r.date,
    counterparty: r.counterparty,
    description: r.description,
    amount: r.amount,
    expected: r.category ?? "",
  }));

  await mkdir(new URL(".", OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(cases, null, 2) + "\n");
  console.log(`Wrote ${cases.length} cases to data/evals/categorizer-cases.json`);
  console.log(`Now open it and check "expected" on every line. Empty means: fill it in yourself.`);
} finally {
  await pool.end();
}
