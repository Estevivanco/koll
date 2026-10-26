import { A2A_PROTOCOL_VERSION, type AgentCard } from "@a2a-js/sdk";

export const PORT = Number(process.env.CATEGORIZER_PORT ?? 4001);

// The agent's "business card". Other agents fetch it to learn who this is,
// where to reach it and what it can do.
export const agentCard: AgentCard = {
  name: "Koll Categorizer",
  description: "Categorizes bank transactions using your own rules first, then AI.",
  version: "0.1.0",
  supportedInterfaces: [
    {
      url: `http://localhost:${PORT}/`,
      protocolBinding: "JSONRPC",
      protocolVersion: A2A_PROTOCOL_VERSION,
      tenant: "",
    },
  ],
  provider: { organization: "Koll", url: "https://github.com/Estevivanco/koll" },
  capabilities: {
    streaming: false,
    pushNotifications: false,
    extensions: [],
    extendedAgentCard: false,
  },
  securitySchemes: {},
  securityRequirements: [],
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain", "application/json"],
  skills: [
    {
      id: "categorize_transactions",
      name: "Categorize transactions",
      description: "Gives uncategorized transactions a category and saves it. Send a number to set how many.",
      tags: ["finance", "categorization"],
      examples: ["Kategorisera 20 transaktioner"],
      inputModes: ["text/plain"],
      outputModes: ["text/plain", "application/json"],
      securityRequirements: [],
    },
  ],
  signatures: [],
};