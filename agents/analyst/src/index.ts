import { answerQuestion } from "./answer.js";
import { pool } from "./db.js";

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('Usage: npx tsx --env-file=.env agents/analyst/src/index.ts "Hur mycket la jag på mat i september?"');
  process.exit(1);
}

try {
  const { answer, sql, rows } = await answerQuestion(question);
  console.log(`\nSQL:\n${sql}\n`);
  console.table(rows);
  console.log(`\n${answer}`);
} finally {
  await pool.end();
}