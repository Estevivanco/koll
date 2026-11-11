import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AGENT_CARD_PATH, type AgentCard } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore, type AgentExecutor } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";

// Starts an A2A agent: serves its agent card and receives messages on one port.
// Returns the server so it can be stopped. Port 0 lets the system pick a free port.
export function startAgentServer(card: AgentCard, executor: AgentExecutor, port: number): Server {
  const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), executor);
  const app = express();

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
  app.use(jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  const server = app.listen(port, () => {
    const actualPort = (server.address() as AddressInfo).port;
    console.log(`${card.name} on http://localhost:${actualPort}`);
    console.log(`Agent card: http://localhost:${actualPort}/${AGENT_CARD_PATH}`);
  });
  return server;
}
