import { Role, type Message } from "@a2a-js/sdk";
import { ClientFactory } from "@a2a-js/sdk/client";

const categorizerUrl = process.env.CATEGORIZER_URL ?? "http://localhost:4001";
const limit = process.argv[2] ?? "10";

// 1. Fetch the categorizer's agent card and build a client from it
const client = await new ClientFactory().createFromUrl(categorizerUrl);
const card = await client.getAgentCard();
console.log(`Found agent: ${card.name}. Skills: ${card.skills.map((s) => s.name).join(", ")}`);

// 2. Send it a message
const message: Message = {
  messageId: crypto.randomUUID(),
  contextId: "",
  taskId: "",
  role: Role.ROLE_USER,
  parts: [
    {
      content: { $case: "text", value: `Kategorisera ${limit} transaktioner` },
      metadata: undefined,
      filename: "",
      mediaType: "text/plain",
    },
  ],
  metadata: {},
  extensions: [],
  referenceTaskIds: [],
};

const result = await client.sendMessage({ tenant: "", message, configuration: undefined, metadata: {} });

// 3. Read the answer. An agent can reply with a Message or a Task; ours sends a Message.
if (!("messageId" in result)) {
  throw new Error(`Expected a message, got a task with state ${result.status?.state}`);
}

for (const part of result.parts) {
  if (part.content?.$case === "text") console.log(part.content.value);
  if (part.content?.$case === "data" && part.content.value.rows.length > 0) {
    console.table(part.content.value.rows);
  }
}