export type Transaction = {
    id: string;
    // ISO date (YYYY-MM-DD), so it sorts correctly as text
    date: string;
    // Negative = money out, positive = money in
    amount: number;
    counterparty: string;
    description: string;
    // Which bank adapter produced this row; more literals get added with new adapters
    source: "swedbank";
    // Optional: empty until the categorizer agent fills it in
    category?: string;
}