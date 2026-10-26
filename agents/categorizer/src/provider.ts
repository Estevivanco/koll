import type { Transaction } from "@koll/shared";
import type { Category } from "./categories.js";

export type CategoryResult = { id: string; category: Category };

// Gemini today, Claude tomorrow: both must look like this
export interface CategorizerProvider {
  categorize(transactions: Transaction[]): Promise<CategoryResult[]>;
}