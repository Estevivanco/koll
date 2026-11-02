// The demo's agents. In live mode the name comes from the real agent cards, so it can be any string.
export type AgentName = "Koll Analyst" | "Koll Categorizer";

export type ResultRow = Record<string, string | number>;

/**
 * What happens, in order, while Koll answers one question.
 * The real backend sends the same events (as a stream), so the terminal never needs to change.
 * Must match agents/orchestrator/src/events.ts.
 */
export type AskEvent =
  | { type: "agents"; names: string[] }
  | { type: "route"; agent: AgentName | (string & {}) | "none"; reason: string }
  | { type: "sql"; sql: string }
  | { type: "rows"; rows: ResultRow[] }
  | { type: "answer"; text: string }
  | { type: "notice"; text: string }
  | { type: "error"; text: string };

export type Ask = (question: string) => AsyncGenerator<AskEvent>;
