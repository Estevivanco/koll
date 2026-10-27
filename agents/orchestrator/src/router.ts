import type { KnownAgent } from "./agents.js";

// All the router needs to know about an agent: its name and its card.
// (No connection, so evals can test the router without sending anything.)
export type AgentInfo = Pick<KnownAgent, "name" | "card">;

// What the router decides: which agent, what to send it, and why
export type Route = { agent: string; message: string; reason: string };

// The answer when no agent fits the request
export const NO_AGENT = "none";

// The "socket" any AI must fit to do the routing. Same idea as the other agents.
export interface Router {
  route(request: string, agents: AgentInfo[]): Promise<Route>;
}

// Turns the agent cards into plain text the AI can read
export function describeAgents(agents: AgentInfo[]): string {
  return agents
    .map((agent) => {
      const skills = agent.card.skills
        .map((s) => `    - ${s.name}: ${s.description} Examples: ${s.examples.join(" | ")}`)
        .join("\n");
      return `- ${agent.name}: ${agent.card.description}\n  Skills:\n${skills}`;
    })
    .join("\n");
}