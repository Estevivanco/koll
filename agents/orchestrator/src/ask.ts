import { createMessage, readData, readText, textPart } from "@koll/a2a";
import { discoverAgents } from "./agents.js";
import type { AskEvent, ResultRow } from "./events.js";
import { createGeminiRouter } from "./gemini.js";
import { NO_AGENT, type Router } from "./router.js";

// The ONE place that decides which AI does the routing
function createRouter(): Router {
  switch (process.env.AI_PROVIDER) {
    case "gemini":
      return createGeminiRouter();
    default:
      throw new Error(`Unknown AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  }
}

// The orchestrator's whole job, as a stream of events: find agents → route → send → answer.
// Both the terminal script (index.ts) and the web server (server.ts) use this.
// It never throws: anything that goes wrong becomes an "error" event the visitor can read.
export async function* askOrchestrator(request: string): AsyncGenerator<AskEvent> {
  // 1. Which agents exist, and what can they do?
  const agents = await discoverAgents();
  if (agents.length === 0) {
    yield { type: "error", text: "No agents are running right now. Start them and try again." };
    return;
  }
  yield { type: "agents", names: agents.map((a) => a.name) };

  // 2. Let the router model pick one
  let route;
  try {
    route = await createRouter().route(request, agents);
  } catch (error) {
    yield { type: "error", text: friendlyError(error) };
    return;
  }

  const agent = agents.find((a) => a.name === route.agent);
  if (route.agent === NO_AGENT || !agent) {
    yield { type: "route", agent: NO_AGENT, reason: route.reason };
    return;
  }
  yield { type: "route", agent: agent.name, reason: route.reason };

  // 3. Send the request to that agent over A2A
  let result;
  try {
    result = await agent.client.sendMessage({
      tenant: "",
      message: createMessage("user", [textPart(route.message)]),
      configuration: undefined,
      metadata: {},
    });
  } catch (error) {
    yield { type: "error", text: friendlyError(error) };
    return;
  }

  // Agents can reply with a Message or a Task; ours send a Message
  if (!("messageId" in result)) {
    yield { type: "error", text: "The agent answered in an unexpected way." };
    return;
  }

  // 4. Pass on what the agent found: the SQL and rows if there are any, then the answer
  const data = readData(result) as { sql?: string; rows?: Record<string, unknown>[] } | undefined;
  if (data?.sql) yield { type: "sql", sql: data.sql };
  if (data?.rows?.length) yield { type: "rows", rows: data.rows.map(cleanRow) };
  yield { type: "answer", text: readText(result) };
}

// Postgres sends numbers like "401.50" as text. Turn them back into numbers,
// so the website can format them and draw bars.
function cleanRow(row: Record<string, unknown>): ResultRow {
  const clean: ResultRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "number") clean[key] = value;
    else if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) clean[key] = Number(value);
    else clean[key] = value === null || value === undefined ? "–" : String(value);
  }
  return clean;
}

// Turns technical errors into something a visitor can act on. The full error goes to the server log.
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[ask]", message);

  if (message.includes("Daily Gemini limit reached")) {
    return "Today's limit for AI calls is reached. Try again tomorrow.";
  }
  if (/timeout|timed out|abort|DEADLINE_EXCEEDED|504/i.test(message)) {
    return "Gemini didn't answer in time. Try again in a moment.";
  }
  if (message.includes("Could not check the daily Gemini limit")) {
    return "The AI is paused because the usage counter can't be reached.";
  }
  return "Something went wrong while answering. Try again.";
}
