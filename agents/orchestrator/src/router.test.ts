import { createAgentCard } from "@koll/a2a";
import { describe, expect, it } from "vitest";
import { describeAgents, type AgentInfo } from "./router.js";

function agent(
  name: string,
  description: string,
  skills: { id: string; name: string; description: string; examples: string[] }[],
): AgentInfo {
  return { name, card: createAgentCard({ name, description, port: 4000, skills }) };
}

const categorizer = agent("Koll Categorizer", "Sorts transactions into categories.", [
  {
    id: "categorize",
    name: "Categorize",
    description: "Gives a transaction a category.",
    examples: ["Kategorisera mina köp", "Sortera transaktionerna"],
  },
]);
const analyst = agent("Koll Analyst", "Answers questions about spending.", [
  {
    id: "ask",
    name: "Answer",
    description: "Answers with numbers.",
    examples: ["Hur mycket spenderade jag på mat?"],
  },
  { id: "trend", name: "Trend", description: "Compares months.", examples: ["Mer än förra månaden?"] },
]);

describe("describeAgents", () => {
  it("gives an empty text for no agents", () => {
    expect(describeAgents([])).toBe("");
  });

  it("lists the name and description of the agent", () => {
    expect(describeAgents([categorizer])).toContain(
      "- Koll Categorizer: Sorts transactions into categories.",
    );
  });

  it("lists every skill with its description and examples joined by |", () => {
    const text = describeAgents([categorizer]);
    expect(text).toContain(
      "    - Categorize: Gives a transaction a category. Examples: Kategorisera mina köp | Sortera transaktionerna",
    );
  });

  it("lists every agent and every skill", () => {
    const text = describeAgents([categorizer, analyst]);
    expect(text).toContain("Koll Categorizer");
    expect(text).toContain("Koll Analyst");
    expect(text).toContain("- Answer:");
    expect(text).toContain("- Trend:");
  });

  it("keeps the agents in the order they were given", () => {
    const text = describeAgents([analyst, categorizer]);
    expect(text.indexOf("Koll Analyst")).toBeLessThan(text.indexOf("Koll Categorizer"));
  });
});
