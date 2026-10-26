import { createGeminiProvider } from "./gemini.js";
import { getUncategorized, saveCategories, pool } from "./db.js";
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

const limit = Number(process.argv[2] ?? 50);

try {
  const transactions = await getUncategorized(limit);

  if (transactions.length === 0) {
    console.log("Nothing left to categorize");
  } else {
    const { matched, rest } = applyRules(transactions);
    const aiResults = rest.length > 0 ? await createProvider().categorize(rest) : [];
    const results = [...matched, ...aiResults];
    console.log(`${matched.length} by rules, ${aiResults.length} by AI`);
    await saveCategories(results);

    const byId = new Map(results.map((r) => [r.id, r.category]));
    console.table(
      transactions.map((t) => ({
        counterparty: t.counterparty,
        amount: t.amount,
        category: byId.get(t.id) ?? "(missing)",
      })),
    );
    console.log(`${results.length}/${transactions.length} categorized`);
  }
} finally {
  await pool.end();
}