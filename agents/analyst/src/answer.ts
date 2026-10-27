import { runReadOnly } from "./db.js";
import { createGeminiModel } from "./gemini.js";
import type { AnalystModel } from "./model.js";

// The ONE place that decides which AI powers the analyst
function createModel(): AnalystModel {
  switch (process.env.AI_PROVIDER) {
    case "gemini":
      return createGeminiModel();
    default:
      throw new Error(`Unknown AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  }
}

export type Answer = { answer: string; sql: string; rows: Record<string, unknown>[] };

// question → SQL → rows → answer
export async function answerQuestion(question: string): Promise<Answer> {
  const model = createModel();
  const sql = await model.writeSql(question);
  const rows = await runReadOnly(sql);
  const answer = await model.explain(question, sql, rows);
  return { answer, sql, rows };
}