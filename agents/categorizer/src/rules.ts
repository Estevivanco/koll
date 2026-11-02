import type { Transaction } from "@koll/shared";
import type { Category } from "@koll/shared";
import type { CategoryResult } from "./provider.js";

// `when` is optional and gets the amount spent in kr (positive number, 0 or less = money in)
type Rule = { match: string; category: Category; when?: (spent: number) => boolean };

// Your own rules always win over the AI. Matched on counterparty, case-insensitive.
// The first matching rule wins, so put the most specific ones first.
// Add a line here when the AI keeps getting a merchant wrong.
const RULES: Rule[] = [
  // Salary. Money in is a negative "spent", so -15000 means 15 000 kr or more received.
  // The bank often labels it just "Lön" without naming the employer, so match both.
  { match: "CIRCLE K", when: (spent) => spent <= -15000, category: "Lön" },
  { match: "LÖN", when: (spent) => spent < 0, category: "Lön" },

  // Circle K: what was bought depends on what it cost
  { match: "CIRCLE K", when: (spent) => spent >= 350, category: "Transport" }, // rented car
  { match: "CIRCLE K", when: (spent) => spent >= 45 && spent <= 55, category: "Tobak" }, // snus
  { match: "CIRCLE K", when: (spent) => spent > 0, category: "Mat" }, // food and drinks

  // Pressbyrån: snus costs 45-55 kr, cheaper is snacks or a drink. Dearer is a mix, so the AI decides.
  // (The bank writes it without the å.)
  { match: "PRESSBYRAN", when: (spent) => spent >= 45 && spent <= 55, category: "Tobak" },
  { match: "PRESSBYRAN", when: (spent) => spent > 0 && spent < 45, category: "Mat" },

  // Cafés count as Restaurang: the analyst already adds Restaurang to "mat"
  { match: "ESPRESSO HOUSE", category: "Restaurang" },
  { match: "DJURGÅRDSBRUNN", category: "Restaurang" },
  { match: "DJURGARDSBRUNN", category: "Restaurang" }, // how the bank writes it

  // Both rackethalls (Enskede and Skogås). Not Hälsa, so it doesn't get mixed up with Apoteket.
  // The bank cuts the name short ("ENSKEDE RACKETH"), so match the start of the word.
  { match: "RACKETH", category: "Nöje" },

  // Insurance. Under Prenumeration so the subscription hunter finds it.
  { match: "CHUBB", category: "Prenumeration" },

  { match: "CSN", category: "Studiemedel" },
];

export function applyRules(transactions: Transaction[]) {
  const matched: CategoryResult[] = [];
  const rest: Transaction[] = [];

  for (const t of transactions) {
    const spent = -t.amount;
    const rule = RULES.find(
      (r) => t.counterparty.toUpperCase().includes(r.match) && (r.when?.(spent) ?? true),
    );
    if (rule) matched.push({ id: t.id, category: rule.category });
    else rest.push(t);
  }

  return { matched, rest };
}
