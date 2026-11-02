import { readFile, access } from "node:fs/promises";
import { CATEGORIES, type Transaction } from "@koll/shared";
import { createProvider } from "../src/categorize.js";
import { pool } from "../src/db.js";
import { applyRules } from "../src/rules.js";

// Categorizer eval: are your rules + the AI putting transactions in the categories YOU would?
//   npm run eval:categorizer
// Uses your own answer key in data/evals/categorizer-cases.json (make it with
// npm run eval:categorizer:prepare). Without it, it runs the made-up example cases.
// Nothing is saved to the database. Cost: 1 Gemini call (everything the rules don't catch goes in one batch).

type Case = { date?: string; counterparty: string; description: string; amount: number; expected: string };

// Below this, the script exits with an error
const MIN_ACCURACY = 0.85;

const OWN = new URL("../../../data/evals/categorizer-cases.json", import.meta.url);
const EXAMPLE = new URL("./categorizer-cases.example.json", import.meta.url);

async function loadCases(): Promise<{ cases: Case[]; source: string }> {
  try {
    await access(OWN);
    return {
      cases: JSON.parse(await readFile(OWN, "utf8")) as Case[],
      source: "your answer key (data/evals)",
    };
  } catch {
    return {
      cases: JSON.parse(await readFile(EXAMPLE, "utf8")) as Case[],
      source: "the made-up example cases",
    };
  }
}

const { cases: all, source } = await loadCases();

// A case without an answer, or with a category that doesn't exist, can't be scored
const cases = all.filter((c) => (CATEGORIES as readonly string[]).includes(c.expected));
const skipped = all.length - cases.length;
console.log(
  `Using ${source}: ${cases.length} cases${skipped ? ` (${skipped} skipped: empty or unknown "expected")` : ""}\n`,
);

// Turn each case into a Transaction, the same shape the categorizer gets from the database
const transactions: Transaction[] = cases.map((c, i) => ({
  id: `case-${i}`,
  date: c.date ?? "2026-01-01",
  amount: c.amount,
  counterparty: c.counterparty,
  description: c.description,
  source: "swedbank",
}));

try {
  // Exactly what the real categorizer does: your rules first, the rest to the AI
  const started = Date.now();
  const { matched, rest } = applyRules(transactions);
  const aiResults = rest.length > 0 ? await createProvider().categorize(rest) : [];
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const got = new Map<string, { category: string; by: "rule" | "AI" }>();
  for (const r of matched) got.set(r.id, { category: r.category, by: "rule" });
  for (const r of aiResults) got.set(r.id, { category: r.category, by: "AI" });

  const results = cases.map((c, i) => {
    const answer = got.get(`case-${i}`) ?? { category: "(missing)", by: "AI" as const };
    return { ...c, got: answer.category, by: answer.by, ok: answer.category === c.expected };
  });

  for (const r of results) {
    const line = `${r.counterparty} (${r.amount} kr)`;
    if (r.ok) console.log(`✓ ${line} → ${r.got}  [${r.by}]`);
    else console.log(`✗ ${line} → ${r.got}, expected ${r.expected}  [${r.by}]`);
  }

  // Scores: overall, and separately for your rules and for the AI
  const score = (list: typeof results) => {
    const passed = list.filter((r) => r.ok).length;
    return list.length ? `${passed}/${list.length} (${Math.round((passed / list.length) * 100)}%)` : "–";
  };
  const passed = results.filter((r) => r.ok).length;
  const accuracy = results.length ? passed / results.length : 0;

  console.log(`\nAccuracy: ${score(results)}   (AI call: ${seconds} s)`);
  console.log(`  by your rules: ${score(results.filter((r) => r.by === "rule"))}`);
  console.log(`  by the AI:     ${score(results.filter((r) => r.by === "AI"))}`);

  // Mix-ups: which category most often became which. This is what tells you what to fix.
  const mixups = new Map<string, number>();
  for (const r of results.filter((r) => !r.ok)) {
    const key = `${r.expected} → ${r.got}`;
    mixups.set(key, (mixups.get(key) ?? 0) + 1);
  }
  if (mixups.size > 0) {
    console.log("\nMix-ups:");
    for (const [key, count] of [...mixups].sort((a, b) => b[1] - a[1])) console.log(`  ${count}× ${key}`);
  }

  if (results.length === 0 || accuracy < MIN_ACCURACY) {
    console.error(`\nBelow the ${MIN_ACCURACY * 100}% target.`);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
