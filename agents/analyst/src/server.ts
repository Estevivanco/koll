import { startAgentServer } from "@koll/a2a";
import { agentCard, PORT } from "./agent-card.js";
import { AnalystExecutor } from "./executor.js";

startAgentServer(agentCard, new AnalystExecutor(), PORT);
