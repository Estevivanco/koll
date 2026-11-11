import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { reserveGeminiCall } from "@koll/budget";
import type { AnalystModel } from "./model.js";
import { SCHEMA } from "./schema.js";

export function createGeminiModel(): AnalystModel {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_REGION;
  const model = process.env.GEMINI_MODEL;
  if (!project || !location || !model) {
    throw new Error("Missing GOOGLE_CLOUD_PROJECT, VERTEX_REGION or GEMINI_MODEL in .env");
  }

  // The SDK retries failed calls up to 5 times by default. When Gemini is rate-limiting (429),
  // that makes things worse and slower, so allow just one retry (attempts includes the first call).
  // A request that gets no answer in 20 s fails with an error instead of hanging forever.
  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    httpOptions: { timeout: 20_000, retryOptions: { attempts: 2 } },
  });

  return {
    async writeSql(question) {
      const today = new Date().toISOString().slice(0, 10);
      await reserveGeminiCall();
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
          `- Frågor om hur mycket man spenderat, utgifter eller kostnader i allmänhet (totalt, per månad, uppdelat ` +
          `per kategori) räknar INTE med överföringar mellan egna konton: lägg till category IS NULL OR ` +
          `category <> 'Överföring'. Hyra (category = 'Boende') räknas med. Vid en total, lägg till kolumnen ` +
          `-SUM(amount) FILTER (WHERE category = 'Boende') AS varav_hyra, så att hyran kan nämnas separat.\n` +
          `- Ge aldrig en kolumn samma namn som en kolumn i tabellen (skriv inte ABS(amount) AS amount): ORDER BY ` +
          `använder då det nya värdet och sorterar fel. Den dyraste utgiften är ORDER BY amount ASC (mest negativt), ` +
          `visa den gärna som ABS(amount) AS belopp.\n` +
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
      return parseSql(response.text);
    },

    async explain(question, sql, rows) {
      await reserveGeminiCall();
      const response = await ai.models.generateContent({
        model,
        contents:
          `Svara kort på svenska (1-3 meningar) på frågan, med hjälp av resultatet nedan.\n` +
          `Använd bara siffrorna i resultatet. Hitta aldrig på siffror. Avrunda till hela kronor.\n` +
          `Om resultatet är tomt, säg att det inte finns några matchande transaktioner.\n` +
          `Om resultatet har kolumnen varav_hyra, nämn hyran separat, t.ex. "varav 5 208 kr hyra".\n\n` +
          `Fråga: ${question}\nSQL: ${sql}\nResultat (JSON): ${JSON.stringify(rows)}`,
        // Putting a number into a sentence needs almost no thinking. The SQL step above keeps the default.
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
      });
      return response.text?.trim() ?? "";
    },
  };
}

// Pulls the SQL out of the model's JSON answer. Throws if there is none.
export function parseSql(text: string | undefined): string {
  const parsed = JSON.parse(text ?? "{}") as { sql?: string };
  if (!parsed.sql) throw new Error("The model returned no SQL");
  return parsed.sql;
}
