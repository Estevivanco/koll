import { readFile } from "node:fs/promises";
import { parseSwedbank } from "./swedbank.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npx tsx packages/importer/src/index.ts <file.csv>");
  process.exit(1);
}

const buffer = await readFile(path);
let text = new TextDecoder("utf-8").decode(buffer);
if (text.includes("\uFFFD")) {
  text = new TextDecoder("windows-1252").decode(buffer); // fixes å ä ö
}

const transactions = parseSwedbank(text);
console.log(`${transactions.length} transactions`);
console.table(transactions.slice(0, 5));