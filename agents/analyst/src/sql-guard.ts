// The text checks for AI-written SQL, kept apart from db.ts so they can run without a database.
// This is only the first of several layers: runReadOnly (db.ts) also uses a READ ONLY transaction,
// and the analyst login can only read, so Postgres itself refuses any change.

// Returns the SQL without the trailing ";", or throws if it isn't one plain SELECT/WITH statement
export function checkSql(sql: string): string {
  const cleaned = sql.trim().replace(/;\s*$/, "");
  if (cleaned.includes(";")) throw new Error("Only one SQL statement is allowed");
  if (!/^(select|with)\b/i.test(cleaned)) throw new Error("Only SELECT queries are allowed");
  return cleaned;
}
