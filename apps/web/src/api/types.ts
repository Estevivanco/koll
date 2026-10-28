export type AgentName = "Koll Analyst" | "Koll Categorizer";

export type ResultRow = Record<string, string | number>;

/**
 * What happens, in order, while Koll answers one question.
 * The real backend will send the same events (as a stream), so the terminal never needs to change.
 */
export type AskEvent =
  | { type: "agents"; names: string[] }
  | { type: "route"; agent: AgentName | "none"; reason: string }
  | { type: "sql"; sql: string }
  | { type: "rows"; rows: ResultRow[] }
  | { type: "answer"; text: string }
  | { type: "notice"; text: string }
  | { type: "error"; text: string };

export type Ask = (question: string) => AsyncGenerator<AskEvent>;
