import { CATEGORIES } from "@koll/shared";

// What the AI needs to know about the database to write correct SQL.
// If you add a column to the table, describe it here too.
export const SCHEMA = `
Tabell: transactions
- id           text     unikt id
- date         date     transaktionsdag
- amount       numeric  belopp i kronor. NEGATIVT = utgift, POSITIVT = inkomst
- counterparty text     motpart, t.ex. "ICA NARA KISTA" (versaler)
- description  text     referens från banken
- source       text     vilken bank, t.ex. "swedbank"
- category     text     en av: ${CATEGORIES.join(", ")}. Kan vara NULL om den inte kategoriserats än.
`;
