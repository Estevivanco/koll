import { GoogleGenAI, Type } from "@google/genai";
import type { AnalystModel } from "./model.js";
import { SCHEMA } from "./schema.js";

export function createGeminiModel(): AnalystModel {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_REGION;
  const model = process.env.GEMINI_MODEL;
  if (!project || !location || !model) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT, VERTEX_REGION or GEMINI_MODEL in .env");
  }

  const ai = new GoogleGenAI({ vertexai: true, project, location });

  return {
    async writeSql(question) {
      const today = new Date().toISOString().slice(0, 10);
      const response = await ai.models.generateContent({
        model,
        contents:
          `Du skriver PostgreSQL för en privatekonomi-app.\n${SCHEMA}\n` +
          `Regler:\n` +
          `- Skriv EN SELECT-fråga. Aldrig INSERT, UPDATE, DELETE eller flera satser.\n` +
          `- Utgifter är negativa belopp. Visa utgifter som positiva tal med -SUM(amount) eller ABS().\n` +
          `- Matcha motparter med ILIKE, t.ex. counterparty ILIKE '%spotify%'.\n` +
          `- "Mat" i en fråga betyder både 'Mat' och 'Restaurang': använd category IN ('Mat', 'Restaurang'). ` +
          `Bara om frågan uttryckligen gäller restaurang, café eller att äta ute används 'Restaurang' ensam.\n` +
          `- Frågor om butiker, ställen eller var man handlar gäller bara vanliga köp. Utesluta alltid de stora ` +
          `posterna: category NOT IN ('Överföring', 'Boende', 'Lön', 'Studiemedel') (och category kan vara NULL, ` +
          `så skriv category IS NULL OR category NOT IN (...)).\n` +
          `- Dagens datum är ${today}. "I september" betyder senaste september.\n\n` +
          `Fråga: ${question}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { sql: { type: Type.STRING } },
            required: ["sql"],
          },
        },
      });
      const parsed = JSON.parse(response.text ?? "{}") as { sql?: string };
      if (!parsed.sql) throw new Error("The model returned no SQL");
      return parsed.sql;
    },

    async explain(question, sql, rows) {
      const response = await ai.models.generateContent({
        model,
        contents:
          `Svara kort på svenska (1-3 meningar) på frågan, med hjälp av resultatet nedan.\n` +
          `Använd bara siffrorna i resultatet. Hitta aldrig på siffror. Avrunda till hela kronor.\n` +
          `Om resultatet är tomt, säg att det inte finns några matchande transaktioner.\n\n` +
          `Fråga: ${question}\nSQL: ${sql}\nResultat (JSON): ${JSON.stringify(rows)}`,
      });
      return response.text?.trim() ?? "";
    },
  };
}