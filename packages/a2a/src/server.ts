import express from "express";
import { AGENT_CARD_PATH, type AgentCard } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore, type AgentExecutor } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";

// Starts an A2A agent: serves its agent card and receives messages on one port
export function startAgentServer(card: AgentCard, executor: AgentExecutor, port: number): void {
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), executor);
  const app = express();

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  app.listen(port, () => {
    console.log(`${card.name} on http://localhost:${port}`);
    console.log(`Agent card: http://localhost:${port}/${AGENT_CARD_PATH}`);
  });
}