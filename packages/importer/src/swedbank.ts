import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import type { Transaction } from "@koll/shared";

// Swedbank's column order. We name columns by position instead of by the header
// text, because the export mangles å/ä/ö in it ("Bokf�rt saldo").
const COLUMNS = [
  "row",
  "clearing",
  "account",
  "product",
  "currency",
  "bookingDate",
  "transactionDate",
  "valueDate",
  "reference",
  "description",
  "amount",
  "balance",
] as const;

type SwedbankRow = Record<(typeof COLUMNS)[number], string>;

// The export turned every å/ä/ö into "�", and the original can't be guessed
// (could be any of the three). So we fix the words we've actually seen.
// Add a line here when a new mangled word shows up in your data.
const MANGLED_WORDS: Record<string, string> = {
  "�verf�ring": "Överföring",
  "SKADEF�RS": "SKADEFÖRS",
  "Str�msn": "Strömsn",
  "L�n": "Lön",
};

function fixSwedish(text: string): string {
  let fixed = text;
  for (const [mangled, correct] of Object.entries(MANGLED_WORDS)) {
    fixed = fixed.replaceAll(mangled, correct);
  }
  return fixed;
}

export function parseSwedbank(text: string): Transaction[] {
  // Skip Swedbank's info line if there is one
  const lines = text.split(/\r?\n/);
  const body = lines[0].startsWith("*") ? lines.slice(1).join("\n") : text;

  const rows: SwedbankRow[] = parse(body, {
    // Read the header row but ignore its spelling; use our names for the columns
    columns: () => [...COLUMNS],
    skip_empty_lines: true,
    trim: true,
  });

  return rows.map(toTransaction);
}

function toTransaction(row: SwedbankRow): Transaction {
  const date = row.transactionDate;
  const amount = Number(row.amount.replace(/\s/g, "").replace(",", "."));
  const counterparty = fixSwedish(row.description);
  const description = fixSwedish(row.reference);

  if (!date || Number.isNaN(amount)) {
    throw new Error(`Bad row: ${JSON.stringify(row)}`);
  }

  // Same transaction always gets the same id → no duplicates on re-import.
  // The balance is included so two identical purchases on one day stay distinct.
  const id = createHash("sha256")
    .update([date, amount, counterparty, row.balance].join("|"))
    .digest("hex")
    .slice(0, 16);

  return { id, date, amount, counterparty, description, source: "swedbank" };
}
