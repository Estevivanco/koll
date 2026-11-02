// What happens, in order, while Koll answers one question.
// The website reads exactly these events, so this must match apps/web/src/api/types.ts.

export type ResultRow = Record<string, string | number>;

export type AskEvent =
  | { type: "agents"; names: string[] }
  | { type: "route"; agent: string; reason: string }
  | { type: "sql"; sql: string }
  | { type: "rows"; rows: ResultRow[] }
  | { type: "answer"; text: string }
  | { type: "notice"; text: string }
  | { type: "error"; text: string };
