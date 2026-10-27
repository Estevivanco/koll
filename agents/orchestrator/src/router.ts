import type { KnownAgent } from "./agents.js";

// What the router decides: which agent, what to send it, and why
export type Route = { agent: string; message: string; reason: string };

// The answer when no agent fits the request
export const NO_AGENT = "none";

// The "socket" any AI must fit to do the routing. Same idea as the other agents.
export interface Router {
  route(request: string, agents: KnownAgent[]): Promise<Route>;
}

// Turns the agent cards into plain text the AI can read
export function describeAgents(agents: KnownAgent[]): string {
  return agents
    .map((agent) => {
      const skills = agent.card.skills
        .map((s) => `    - ${s.name}: ${s.description} Examples: ${s.examples.join(" | ")}`)
        .join("\n");
      return `- ${agent.name}: ${agent.card.description}\n  Skills:\n${skills}`;
    })
    .join("\n");
}