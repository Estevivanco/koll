import type { Transaction } from "@koll/shared";
import type { Category } from "./categories.js";
import type { CategoryResult } from "./provider.js";

// Your own rules always win over the AI. Matched on counterparty, case-insensitive.
// Add a line here when the AI keeps getting a merchant wrong.
const RULES: { match: string; category: Category }[] = [
  { match: "CIRCLE K", category: "Restaurang" },
];

export function applyRules(transactions: Transaction[]) {
  const matched: CategoryResult[] = [];
  const rest: Transaction[] = [];

  for (const t of transactions) {
    const rule = RULES.find((r) => t.counterparty.toUpperCase().includes(r.match));
    if (rule) matched.push({ id: t.id, category: rule.category });
    else rest.push(t);
  }

  return { matched, rest };
}