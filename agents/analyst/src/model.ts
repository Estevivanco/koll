// The "socket" any AI must fit to power the analyst. Same idea as the categorizer's provider.
export interface AnalystModel {
  // Turn a question into one SQL SELECT query
  writeSql(question: string): Promise<string>;
  // Turn the query result into a short answer for a human
  explain(question: string, sql: string, rows: Record<string, unknown>[]): Promise<string>;
}
