import { createAgentCard } from "@koll/a2a";

export const PORT = Number(process.env.CATEGORIZER_PORT ?? 4001);

// The agent's "business card". Other agents fetch it to learn who this is,
// where to reach it and what it can do.
export const agentCard = createAgentCard({
  name: "Koll Categorizer",
  description: "Categorizes bank transactions using your own rules first, then AI.",
  port: PORT,
  skills: [
    {
      id: "categorize_transactions",
      name: "Categorize transactions",
      description: "Gives uncategorized transactions a category and saves it. Send a number to set how many.",
      examples: ["Kategorisera 20 transaktioner"],
    },
  ],
});