import { query } from "./db.js";

// Every tool is plain, fixed SQL with $1-style parameters. No AI writes SQL here:
// the AI app (e.g. Claude) only chooses WHICH tool to call and with what values.

type Period = { from?: string; to?: string };

// Spending per category, biggest first
export function spendingByCategory({ from, to }: Period) {
  return query(
    `SELECT COALESCE(category, 'Okategoriserad') AS category,
            -SUM(amount)::numeric(12,2)          AS spent_kr,
            COUNT(*)::int                        AS purchases
     FROM transactions
     WHERE amount < 0
       AND ($1::date IS NULL OR date >= $1::date)
       AND ($2::date IS NULL OR date <= $2::date)
     GROUP BY 1
     ORDER BY spent_kr DESC`,
    [from ?? null, to ?? null],
  );
}

// Find transactions by text, category and/or period, newest first
export function searchTransactions({
  text,
  category,
  from,
  to,
  limit = 20,
}: Period & { text?: string; category?: string; limit?: number }) {
  return query(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date, amount, counterparty, category
     FROM transactions
     WHERE ($1::text IS NULL OR counterparty ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR category = $2)
       AND ($3::date IS NULL OR date >= $3::date)
       AND ($4::date IS NULL OR date <= $4::date)
     ORDER BY date DESC
     LIMIT $5`,
    [text ?? null, category ?? null, from ?? null, to ?? null, limit],
  );
}

// Money in and out per month, newest month first
export function monthlyTotals({ months = 6 }: { months?: number }) {
  return query(
    `SELECT to_char(date, 'YYYY-MM')                                        AS month,
            SUM(amount) FILTER (WHERE amount > 0)::numeric(12,2)            AS income_kr,
            (-SUM(amount) FILTER (WHERE amount < 0))::numeric(12,2)         AS spent_kr,
            SUM(amount)::numeric(12,2)                                      AS net_kr
     FROM transactions
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT $1`,
    [months],
  );
}

// Merchants that charged you in at least 3 different months: likely subscriptions
export function recurringPayments() {
  return query(
    `SELECT counterparty,
            COUNT(DISTINCT to_char(date, 'YYYY-MM'))::int AS months_charged,
            (-AVG(amount))::numeric(12,2)                 AS average_kr,
            (-MIN(amount))::numeric(12,2)                 AS highest_kr,
            to_char(MAX(date), 'YYYY-MM-DD')              AS last_charged
     FROM transactions
     WHERE amount < 0
     GROUP BY counterparty
     HAVING COUNT(DISTINCT to_char(date, 'YYYY-MM')) >= 3
     ORDER BY months_charged DESC, average_kr DESC`,
  );
}
