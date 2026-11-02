import { liveAsk } from "./liveAsk";
import { mockAsk } from "./mockAsk";
import type { Ask } from "./types";

export type { Ask, AskEvent, AgentName, ResultRow } from "./types";

/**
 * Demo or live. Set when the site starts: `npm run web` = demo, `npm run web:live` = live.
 * - Demo: scripted answers on made-up data. No backend, no Gemini calls. Safe to show anyone.
 * - Live: the real agents on your real data, through the orchestrator's POST /api/ask.
 *   Only for you, on your own machine.
 */
export const LIVE = import.meta.env.VITE_KOLL_MODE === "live";

/** The one place that decides where answers come from. Nothing else in the app needs to know. */
export const ask: Ask = LIVE ? liveAsk : mockAsk;

export const EXAMPLE_QUESTIONS = [
  "Hur mycket la jag på mat i september?",
  "Vilka tre butiker handlar jag mest hos?",
  "Kategorisera 20 transaktioner",
  "Vad blir vädret imorgon?",
];

export const MAX_QUESTION_LENGTH = 200;
