import { startAgentServer } from "@koll/a2a";
import { agentCard, PORT } from "./agent-card.js";
import { CategorizerExecutor } from "./executor.js";

startAgentServer(agentCard, new CategorizerExecutor(), PORT);