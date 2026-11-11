import express from "express";
import { askOrchestrator } from "./ask.js";
import type { AskEvent } from "./events.js";

// The orchestrator as a web app, so the website can ask questions.
// POST /api/ask streams the answer as NDJSON: one JSON event per line, sent as soon as it happens.
// Kept apart from server.ts (which starts listening) so tests can start the app on any port.

const MAX_QUESTION_LENGTH = 200;

export type AppOptions = {
  // How the question is answered. Tests pass a fake, so no agents or Gemini are needed.
  ask?: (question: string) => AsyncIterable<AskEvent>;
  // Every question costs up to 3 Gemini calls, so limit how many one visitor can ask
  limitPerHour?: number;
};

export function createApp({
  ask = askOrchestrator,
  limitPerHour = Number(process.env.ASK_LIMIT_PER_HOUR ?? 20),
}: AppOptions = {}) {
  const app = express();
  // Questions are short: anything bigger than 2 KB is refused before we read it
  app.use(express.json({ limit: "2kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Remembers when each visitor (by IP address) asked, for the last hour. Resets when the server restarts.
  const recentQuestions = new Map<string, number[]>();

  function allowQuestion(visitor: string): boolean {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recent = (recentQuestions.get(visitor) ?? []).filter((time) => time > hourAgo);
    if (recent.length >= limitPerHour) {
      recentQuestions.set(visitor, recent);
      return false;
    }
    recent.push(Date.now());
    recentQuestions.set(visitor, recent);
    return true;
  }

  app.post("/api/ask", async (req, res) => {
    const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";

    // Check everything that's free BEFORE anything that costs a Gemini call
    if (!question) {
      res.status(400).json({ error: "Write a question first." });
      return;
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      res.status(400).json({ error: `Questions can be at most ${MAX_QUESTION_LENGTH} characters.` });
      return;
    }
    if (!allowQuestion(req.ip ?? "unknown")) {
      res.status(429).json({ error: `That's ${limitPerHour} questions this hour. Try again later.` });
      return;
    }

    // From here on we stream: each event is written the moment it happens
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();

    // If the visitor closes the page, stop sending (the current Gemini call still finishes)
    let visitorLeft = false;
    res.on("close", () => {
      visitorLeft = true;
    });

    for await (const event of ask(question)) {
      if (visitorLeft) break;
      res.write(JSON.stringify(event) + "\n");
    }
    res.end();
  });

  return app;
}
