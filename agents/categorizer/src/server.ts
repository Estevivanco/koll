import express from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { agentCard, PORT } from "./agent-card.js";
import { CategorizerExecutor } from "./executor.js";

// The SDK's "receptionist": takes requests in and hands them to our executor
const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new CategorizerExecutor(),
);

const app = express();

// GET /.well-known/agent-card.json → the business card
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
// POST / → A2A messages (JSON-RPC)
app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

app.listen(PORT, () => {
  console.log(`Categorizer agent on http://localhost:${PORT}`);
  console.log(`Agent card: http://localhost:${PORT}/${AGENT_CARD_PATH}`);
});