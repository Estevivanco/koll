import { mockAsk } from "./mockAsk";
import type { Ask } from "./types";

export type { Ask, AskEvent, AgentName, ResultRow } from "./types";

/**
 * The one place that decides where answers come from.
 * Today: the demo mock. Later: a function that calls the orchestrator's POST /ask
 * and yields the same events as they stream in. Nothing else in the app needs to change.
 */
export const ask: Ask = mockAsk;

export const EXAMPLE_QUESTIONS = [
  "Hur mycket la jag på mat i september?",
  "Vilka tre butiker handlar jag mest hos?",
  "Kategorisera 20 transaktioner",
  "Vad blir vädret imorgon?",
];

export const MAX_QUESTION_LENGTH = 200;
