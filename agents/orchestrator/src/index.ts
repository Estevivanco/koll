import { createMessage, readData, readText, textPart } from "@koll/a2a";
import { discoverAgents } from "./agents.js";
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

const request = process.argv.slice(2).join(" ");
if (!request) {
  console.error(
    'Usage: npx tsx --env-file=.env agents/orchestrator/src/index.ts "Hur mycket la jag på mat i september?"',
  );
  process.exit(1);
}

// 1. Find out which agents exist and what they can do
const agents = await discoverAgents();
if (agents.length === 0) {
  console.error("No agents are running. Start them first.");
  process.exit(1);
}
console.log(`Agents found: ${agents.map((a) => a.name).join(", ")}`);

// 2. Let the AI pick the agent
const route = await createRouter().route(request, agents);
const agent = agents.find((a) => a.name === route.agent);

if (route.agent === NO_AGENT || !agent) {
  console.log(`\nNo agent can handle that. ${route.reason}`);
  process.exit(0);
}
console.log(`→ ${agent.name}: "${route.message}"`);
console.log(`  Why: ${route.reason}\n`);

// 3. Send the message to the chosen agent
const result = await agent.client.sendMessage({
  tenant: "",
  message: createMessage("user", [textPart(route.message)]),
  configuration: undefined,
  metadata: {},
});

// 4. Print the answer. Agents can reply with a Message or a Task; ours send a Message.
if (!("messageId" in result)) {
  throw new Error(`Expected a message, got a task with state ${result.status?.state}`);
}

console.log(readText(result));

const data = readData(result) as { sql?: string; rows?: unknown[] } | undefined;
if (data?.sql) console.log(`\nSQL:\n${data.sql}`);
if (data?.rows?.length) console.table(data.rows);
