import { readFile } from "node:fs/promises";
import { parseSwedbank } from "./swedbank.js";
import { ensureSchema, saveTransactions, pool } from "./db.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx --env-file=.env packages/importer/src/index.ts <file.csv>");
  process.exit(1);
}

const buffer = await readFile(path);
let text = new TextDecoder("utf-8").decode(buffer);
if (text.includes("\uFFFD")) {
  // A fresh export saved as windows-1252 decodes correctly this way. But if the "�" is
  // already baked into the file, windows-1252 turns it into "ï¿½", so keep the UTF-8 text.
  const latin = new TextDecoder("windows-1252").decode(buffer);
  if (!latin.includes("ï¿½")) text = latin;
}

const transactions = parseSwedbank(text);

try {
  await ensureSchema();
  const inserted = await saveTransactions(transactions);
  console.log(`${transactions.length} read, ${inserted} new, ${transactions.length - inserted} already there`);
} finally {
  // Runs even if something above threw, so the connection never stays open
  await pool.end();
}