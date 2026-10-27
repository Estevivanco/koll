import type { AgentCard } from "@a2a-js/sdk";
import { ClientFactory, type Client } from "@a2a-js/sdk/client";

export type KnownAgent = { name: string; card: AgentCard; client: Client };

// Where to look for agents. In Docker/Kubernetes, set AGENT_URLS to their service addresses.
const AGENT_URLS = (process.env.AGENT_URLS ?? "http://localhost:4001,http://localhost:4002")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

// Fetch every agent's card. An agent that isn't running is skipped with a warning.
export async function discoverAgents(): Promise<KnownAgent[]> {
  const factory = new ClientFactory();

  const results = await Promise.allSettled(
    AGENT_URLS.map(async (url) => {
      const client = await factory.createFromUrl(url);
      const card = await client.getAgentCard();
      return { name: card.name, card, client };
    }),
  );

  const agents: KnownAgent[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") agents.push(result.value);
    else console.warn(`⚠ No agent answered at ${AGENT_URLS[i]}. Is it running?`);
  });
  return agents;
}