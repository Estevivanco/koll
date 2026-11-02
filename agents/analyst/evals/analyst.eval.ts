import { readFile } from "node:fs/promises";
import { answerQuestion } from "../src/answer.js";
import { pool, runReadOnly } from "../src/db.js";

// Analyst eval: does the AI's SQL find the right number, and does the answer say it?
//   npm run eval:analyst
// Each case has a question and "truth_sql": a query YOU wrote that gives the right number.
// The truth is computed live from your database, so the cases stay right as new transactions come in.
// Cost: 2 Gemini calls per case (write SQL + explain).

type Case = { question: string; truth_sql: string };

const MIN_ACCURACY = 0.8;
// How close counts as right. Kronor are rounded to whole numbers in answers, so allow half a krona
// plus 0.1% for big sums. Counts stay exact: "1 transaction" is not "0 transactions".
const tolerance = (target: number) => 0.51 + Math.abs(target) * 0.001;

const cases = JSON.parse(await readFile(new URL("./analyst-cases.json", import.meta.url), "utf8")) as Case[];
const only = process.env.ONLY?.toLowerCase();
const selected = only ? cases.filter((c) => c.question.toLowerCase().includes(only)) : cases;

// All the numbers in a piece of text. Handles Swedish formatting, where thousands are
// separated by a space (often a non-breaking one) and decimals by a comma.
function numbersInText(text: string): number[] {
  const joined = text.replace(/(\d)[\s\u00a0\u202f](?=\d{3}\b)/g, "$1");
  return [...joined.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
}

// All the numbers in the rows the AI's SQL returned (Postgres sends many of them as text).
// Empty values are left out: an empty SUM means "no data", not the number 0.
function numbersInRows(rows: Record<string, unknown>[]): number[] {
  return rows
    .flatMap((row) => Object.values(row))
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => Number(value))
    .filter((n) => Number.isFinite(n));
}

const near = (numbers: number[], target: number) =>
  numbers.some((n) => Math.abs(Math.abs(n) - Math.abs(target)) <= tolerance(target));
// When the right answer is "nothing" (0, or an empty SUM), the answer may say so in words
const SAYS_NOTHING = /\b(inga|inget|ingen|inte några|inte något)\b/i;

type Result = {
  question: string;
  truth: number;
  sqlOk: boolean;
  answerOk: boolean;
  seconds: string;
  note?: string;
};
const results: Result[] = [];
let errors = 0;

try {
  console.log(`Running ${selected.length} cases…\n`);

  for (const c of selected) {
    // 1. The right answer, from your own SQL
    const truthRows = await runReadOnly(c.truth_sql);
    const truthValue = Object.values(truthRows[0] ?? {})[0];
    const truth = truthValue === null || truthValue === undefined ? 0 : Number(truthValue);

    // 2. What the analyst does with the question
    const started = Date.now();
    let answer;
    try {
      answer = await answerQuestion(c.question);
    } catch (error) {
      errors++;
      console.log(`! ${c.question}\n    Error: ${(error as Error).message.slice(0, 120)}`);
      continue;
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    // 3. Compare: is the right number in the SQL result? Is it in the answer text?
    const rowNumbers = numbersInRows(answer.rows);
    const textNumbers = numbersInText(answer.answer);
    const sqlOk = truth === 0 ? rowNumbers.length === 0 || near(rowNumbers, 0) : near(rowNumbers, truth);
    const answerOk =
      truth === 0 ? near(textNumbers, 0) || SAYS_NOTHING.test(answer.answer) : near(textNumbers, truth);
    results.push({ question: c.question, truth, sqlOk, answerOk, seconds });

    const mark = sqlOk && answerOk ? "✓" : "✗";
    console.log(`${mark} ${c.question}  (${seconds} s)`);
    if (!sqlOk || !answerOk) {
      console.log(`    right number: ${truth}`);
      if (!sqlOk)
        console.log(
          `    SQL:    ${answer.sql.replace(/\s+/g, " ")}\n    rows:   ${JSON.stringify(answer.rows).slice(0, 160)}`,
        );
      if (!answerOk) console.log(`    answer: ${answer.answer}`);
    }
  }

  const count = (key: "sqlOk" | "answerOk") => results.filter((r) => r[key]).length;
  const both = results.filter((r) => r.sqlOk && r.answerOk).length;
  const pct = (n: number) => (results.length ? Math.round((n / results.length) * 100) : 0);

  console.log(`\nRight SQL result: ${count("sqlOk")}/${results.length} (${pct(count("sqlOk"))}%)`);
  console.log(`Right answer text: ${count("answerOk")}/${results.length} (${pct(count("answerOk"))}%)`);
  console.log(`Both right:        ${both}/${results.length} (${pct(both)}%)`);
  if (errors) console.log(`${errors} case(s) not scored because of errors.`);

  const accuracy = results.length ? both / results.length : 0;
  if (results.length === 0 || accuracy < MIN_ACCURACY || errors / selected.length > 0.1) {
    console.error(`\nBelow the ${MIN_ACCURACY * 100}% target, or too many errors.`);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
