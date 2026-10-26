import { GoogleGenAI, Type } from "@google/genai";
import { CATEGORIES, type Category } from "./categories.js";
import type { CategorizerProvider } from "./provider.js";

export function createGeminiProvider(): CategorizerProvider {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_REGION;
  const model = process.env.GEMINI_MODEL;
  if (!project || !location || !model) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT, VERTEX_REGION or GEMINI_MODEL in .env");
  }

  const ai = new GoogleGenAI({ vertexai: true, project, location });

  return {
    async categorize(transactions) {
      const lines = transactions
        .map((t) => `${t.id} | ${t.amount} kr | ${t.counterparty} | ${t.description}`)
        .join("\n");

      const response = await ai.models.generateContent({
        model,
        contents:
          `Kategorisera varje banktransaktion.\n` +
          `Tillåtna kategorier: ${CATEGORIES.join(", ")}.\n` +
          `Negativt belopp = utgift, positivt = inkomst. Om du är osäker, välj "Övrigt".\n\n` +
          `Transaktioner (id | belopp | motpart | referens):\n${lines}`,
        config: {
          // Forces the answer to be JSON in exactly this shape, no free text
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING, enum: [...CATEGORIES] },
              },
              required: ["id", "category"],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text ?? "[]") as { id: string; category: string }[];

      // Never trust the AI blindly: anything outside the list becomes "Övrigt"
      return parsed.map((r) => ({
        id: r.id,
        category: isCategory(r.category) ? r.category : "Övrigt",
      }));
    },
  };
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}