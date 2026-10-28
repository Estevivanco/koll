import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { reserveGeminiCall } from "@koll/budget";
import { describeAgents, NO_AGENT, type Route, type Router } from "./router.js";

export function createGeminiRouter(): Router {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_REGION;
  // The router's job is simple, so it can use a smaller, faster model than the analyst
  const model = process.env.ROUTER_MODEL ?? process.env.GEMINI_MODEL;
  if (!project || !location || !model) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT, VERTEX_REGION or GEMINI_MODEL in .env");
  }

  // The SDK retries failed calls up to 5 times by default. When Gemini is rate-limiting (429),
  // that makes things worse and slower, so allow just one retry (attempts includes the first call).
  // A request that gets no answer in 8 s fails (a healthy call takes 2-6 s) with an error instead of hanging forever.
  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    httpOptions: { timeout: 8_000, retryOptions: { attempts: 2 } },
  });

  return {
    async route(request, agents) {
      const names = agents.map((a) => a.name);

      await reserveGeminiCall();

      const response = await ai.models.generateContent({
        model,
        contents:
          `You are the router of a personal finance system. Pick the ONE agent that should handle the request.\n\n` +
          `Agents:\n${describeAgents(agents)}\n\n` +
          `Rules:\n` +
          `- Answer with the agent's exact name, or "${NO_AGENT}" if no agent can handle the request.\n` +
          `- If the request needs several agents, pick the agent for the FIRST step ` +
          `(for example: categorize first, analyse after).\n` +
          `- Pick "${NO_AGENT}" if the request asks WHY something got a category, or asks to add, change ` +
          `or delete transactions, rules or files. No agent can do that.\n` +
          `- "message" is what we send to that agent. Keep the user's language (usually Swedish) ` +
          `and phrase it the way the agent's skill examples do.\n` +
          `- "reason" is one short sentence explaining the choice.\n\n` +
          `Request: ${request}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              // The AI can only answer with a name that really exists (or "none")
              agent: { type: Type.STRING, enum: [...names, NO_AGENT] },
              message: { type: Type.STRING },
              reason: { type: Type.STRING },
            },
            required: ["agent", "message", "reason"],
          },
        },
      });

      const parsed = JSON.parse(response.text ?? "{}") as Partial<Route>;

      // Never trust the AI blindly: an unknown name becomes "no agent"
      const agent = parsed.agent && names.includes(parsed.agent) ? parsed.agent : NO_AGENT;
      return {
        agent,
        message: parsed.message || request,
        reason: parsed.reason ?? "",
      };
    },
  };
}
