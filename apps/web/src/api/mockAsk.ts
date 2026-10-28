import type { AgentName, Ask, AskEvent, ResultRow } from "./types";

/*
  Demo mode: canned answers that behave like the real agents (same steps, same wording),
  so the website works without a backend, without any real data and without spending Gemini calls.
*/

type CannedAnswer = {
  /** Which questions this answer is for */
  match: RegExp;
  agent: AgentName;
  reason: string;
  sql?: string;
  rows?: ResultRow[];
  answer: string;
};

const CANNED: CannedAnswer[] = [
  {
    match: /kategoris|sortera|fixa kategor/i,
    agent: "Koll Categorizer",
    reason: "Begäran gäller att sortera transaktioner i kategorier, vilket Koll Categorizer gör.",
    rows: [
      { counterparty: "ICA MAXI", amount: -312, category: "Mat" },
      { counterparty: "SL ACCESS", amount: -950, category: "Transport" },
      { counterparty: "SPOTIFY", amount: -129, category: "Prenumeration" },
      { counterparty: "ESPRESSO HOUSE", amount: -58, category: "Restaurang" },
    ],
    answer: "Categorized 20: 6 by rules, 14 by AI.",
  },
  {
    match: /butik|handlar|ställen/i,
    agent: "Koll Analyst",
    reason: "Frågan gäller var pengarna går, vilket Koll Analyst svarar på med SQL.",
    sql: "SELECT counterparty, -SUM(amount) AS total_spent FROM transactions\nWHERE amount < 0 AND category NOT IN ('Överföring', 'Boende', 'Lön', 'Studiemedel')\nGROUP BY counterparty ORDER BY total_spent DESC LIMIT 3;",
    rows: [
      { counterparty: "ICA MAXI", total_spent: 3180 },
      { counterparty: "WILLYS", total_spent: 2640 },
      { counterparty: "COOP KONSUM", total_spent: 1910 },
    ],
    answer:
      "De tre butikerna du handlar mest hos är ICA MAXI (3 180 kr), WILLYS (2 640 kr) och COOP KONSUM (1 910 kr).",
  },
  {
    match: /totalt|spenderade|utgifter|oktober/i,
    agent: "Koll Analyst",
    reason: "Frågan gäller summan av utgifter under en period, vilket Koll Analyst svarar på med SQL.",
    sql: "SELECT -SUM(amount) AS total_spent FROM transactions\nWHERE amount < 0 AND date >= '2026-10-01' AND date < '2026-11-01';",
    rows: [{ total_spent: 11560 }],
    answer: "Du spenderade totalt 11 560 kronor i oktober hittills.",
  },
  {
    match: /\bmat\b|restaurang|äta ute/i,
    agent: "Koll Analyst",
    reason: "Frågan gäller utgifter i en kategori och en period, vilket Koll Analyst svarar på med SQL.",
    sql: "SELECT category, -SUM(amount) AS total FROM transactions\nWHERE category IN ('Mat', 'Restaurang') AND amount < 0\n  AND date >= '2026-09-01' AND date < '2026-10-01'\nGROUP BY category;",
    rows: [
      { category: "Mat", total: 3420 },
      { category: "Restaurang", total: 2180 },
    ],
    answer:
      "Du la totalt 5 600 kronor på mat i september, varav 3 420 kr i butik och 2 180 kr på restaurang.",
  },
];

/** Questions that look like finance questions, but the demo has no canned answer for */
const LOOKS_LIKE_FINANCE = /kr\b|kronor|köp|betal|lön|hur (mycket|många)|dyraste|billigaste|prenumeration/i;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, prefersReducedMotion() ? 0 : ms));

export const mockAsk: Ask = async function* (question: string): AsyncGenerator<AskEvent> {
  await pause(350);
  yield { type: "agents", names: ["Koll Categorizer", "Koll Analyst"] };
  await pause(650);

  const hit = CANNED.find((c) => c.match.test(question));

  if (!hit) {
    if (LOOKS_LIKE_FINANCE.test(question)) {
      yield {
        type: "route",
        agent: "Koll Analyst",
        reason: "Frågan gäller dina utgifter, vilket Koll Analyst svarar på med SQL.",
      };
      await pause(500);
      yield {
        type: "notice",
        text: "Demo mode only knows a few questions. The live version writes new SQL for any question. Try one of the examples below.",
      };
      return;
    }
    yield {
      type: "route",
      agent: "none",
      reason: "Frågan handlar inte om dina transaktioner, så ingen agent kan hjälpa till.",
    };
    return;
  }

  yield { type: "route", agent: hit.agent, reason: hit.reason };
  await pause(750);

  if (hit.sql) {
    yield { type: "sql", sql: hit.sql };
    await pause(650);
  }
  if (hit.rows) {
    yield { type: "rows", rows: hit.rows };
    await pause(550);
  }
  yield { type: "answer", text: hit.answer };
};
