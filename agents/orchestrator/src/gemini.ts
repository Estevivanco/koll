import { GoogleGenAI, Type } from "@google/genai";
import { describeAgents, NO_AGENT, type Route, type Router } from "./router.js";

export function createGeminiRouter(): Router {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_REGION;
  const model = process.env.GEMINI_MODEL;
  if (!project || !location || !model) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT, VERTEX_REGION or GEMINI_MODEL in .env");
  }

  const ai = new GoogleGenAI({ vertexai: true, project, location });

  return {
    async route(request, agents) {
      const names = agents.map((a) => a.name);

      const response = await ai.models.generateContent({
        model,
        contents:
          `You are the router of a personal finance system. Pick the ONE agent that should handle the request.\n\n` +
          `Agents:\n${describeAgents(agents)}\n\n` +
          `Rules:\n` +
          `- Answer with the agent's exact name, or "${NO_AGENT}" if no agent can handle the request.\n` +
          `- "message" is what we send to that agent. Keep the user's language (usually Swedish) ` +
          `and phrase it the way the agent's skill examples do.\n` +
          `- "reason" is one short sentence explaining the choice.\n\n` +
          `Request: ${request}`,
        config: {
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
      return { agent, message: parsed.message ?? request, reason: parsed.reason ?? "" };
    },
  };
}
