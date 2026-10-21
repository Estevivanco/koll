export type Transaction = {
    id: string;
    date: string;
    amount: number;
    counterparty: string;
    description: string;
    source: "swedbank";
    category?: string;
}