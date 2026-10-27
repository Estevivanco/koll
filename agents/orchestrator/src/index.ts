import { ClientFactory } from "@a2a-js/sdk/client";
import { createMessage, readData, readText, textPart } from "@koll/a2a";

// Where each agent lives. Step 7 replaces "you pick the agent" with "the AI picks".
const AGENTS: Record<string, string> = {
  categorizer: process.env.CATEGORIZER_URL ?? "http://localhost:4001",
  analyst: process.env.ANALYST_URL ?? "http://localhost:4002",
};

const [agentName, ...words] = process.argv.slice(2);
const text = words.join(" ");
const url = AGENTS[agentName];

if (!url || !text) {
  console.error(`Usage: npx tsx --env-file=.env agents/orchestrator/src/index.ts <${Object.keys(AGENTS).join("|")}> "<message>"`);
  process.exit(1);
}

// 1. Fetch the agent's card and build a client from it
const client = await new ClientFactory().createFromUrl(url);
const card = await client.getAgentCard();
console.log(`→ ${card.name}: "${text}"\n`);

// 2. Send the message
const result = await client.sendMessage({
  tenant: "",
  message: createMessage("user", [textPart(text)]),
  configuration: undefined,
  metadata: {},
});

// 3. Print the answer. Agents can reply with a Message or a Task; ours send a Message.
if (!("messageId" in result)) {
  throw new Error(`Expected a message, got a task with state ${result.status?.state}`);
}

console.log(readText(result));

const data = readData(result) as { sql?: string; rows?: unknown[] } | undefined;
if (data?.sql) console.log(`\nSQL:\n${data.sql}`);
if (data?.rows?.length) console.table(data.rows);