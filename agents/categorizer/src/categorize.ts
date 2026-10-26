import { getUncategorized, saveCategories } from "./db.js";
import { createGeminiProvider } from "./gemini.js";
import type { CategorizerProvider } from "./provider.js";
import { applyRules } from "./rules.js";

// The ONE place that decides which AI is used
function createProvider(): CategorizerProvider {
  switch (process.env.AI_PROVIDER) {
    case "gemini":
      return createGeminiProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  }
}

export type CategorizeSummary = {
  total: number;
  fromRules: number;
  fromAi: number;
  rows: { counterparty: string; amount: number; category: string }[];
};

// The categorizer's actual job. Used by both the terminal script and the A2A server.
export async function categorizeBatch(limit: number): Promise<CategorizeSummary> {
  const transactions = await getUncategorized(limit);
  if (transactions.length === 0) {
    return { total: 0, fromRules: 0, fromAi: 0, rows: [] };
  }

  const { matched, rest } = applyRules(transactions);
  const aiResults = rest.length > 0 ? await createProvider().categorize(rest) : [];
  const results = [...matched, ...aiResults];
  await saveCategories(results);

  const byId = new Map(results.map((r) => [r.id, r.category]));
  return {
    total: transactions.length,
    fromRules: matched.length,
    fromAi: aiResults.length,
    rows: transactions.map((t) => ({
      counterparty: t.counterparty,
      amount: t.amount,
      category: byId.get(t.id) ?? "(missing)",
    })),
  };
}