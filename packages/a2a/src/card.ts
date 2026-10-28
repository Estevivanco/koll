import { A2A_PROTOCOL_VERSION, type AgentCard, type AgentSkill } from "@a2a-js/sdk";

type CardInput = {
  name: string;
  description: string;
  port: number;
  skills: { id: string; name: string; description: string; examples: string[] }[];
};

// In Docker/Kubernetes an agent is reached by its service name (e.g. "categorizer"), not localhost.
// Set PUBLIC_HOST there; on your own machine the default is right.
const PUBLIC_HOST = process.env.PUBLIC_HOST ?? "localhost";

// Builds a full agent card from the few fields that differ between our agents
export function createAgentCard(input: CardInput): AgentCard {
  const skills: AgentSkill[] = input.skills.map((s) => ({
    ...s,
    tags: [],
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
    securityRequirements: [],
  }));

  return {
    name: input.name,
    description: input.description,
    version: "0.1.0",
    supportedInterfaces: [
      {
        url: `http://${PUBLIC_HOST}:${input.port}/`,
        protocolBinding: "JSONRPC",
        protocolVersion: A2A_PROTOCOL_VERSION,
        tenant: "",
      },
    ],
    provider: { organization: "Koll", url: "https://github.com/Estevivanco/koll" },
    capabilities: { streaming: false, pushNotifications: false, extensions: [], extendedAgentCard: false },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills,
    signatures: [],
  };
}
