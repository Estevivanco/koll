import { createAgentCard } from "@koll/a2a";

export const PORT = Number(process.env.ANALYST_PORT ?? 4002);

export const agentCard = createAgentCard({
  name: "Koll Analyst",
  description: "Answers questions about your spending by writing and running read-only SQL.",
  port: PORT,
  skills: [
    {
      id: "answer_spending_question",
      name: "Answer spending questions",
      description: "Answers questions in Swedish about amounts, categories, merchants and periods.",
      examples: ["Hur mycket la jag på mat i september?", "Vilka tre butiker handlar jag mest hos?"],
    },
  ],
});
