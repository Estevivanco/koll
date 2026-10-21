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
  // A fresh export saved as windows-1252 decodes correctly this way. But if the "�" is
  // already baked into the file, windows-1252 turns it into "ï¿½", so keep the UTF-8 text.
  const latin = new TextDecoder("windows-1252").decode(buffer);
  if (!latin.includes("ï¿½")) text = latin;
}

const transactions = parseSwedbank(text);
console.log(`${transactions.length} transactions`);
console.table(transactions.slice(0, 5));