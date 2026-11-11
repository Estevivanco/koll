import { createAgentCard, startAgentServer } from "@koll/a2a";
import { createServer, type Server } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "../../agents/analyst/src/db.js";
import { AnalystExecutor } from "../../agents/analyst/src/executor.js";
import { createGeminiModel } from "../../agents/analyst/src/gemini.js";
import { askOrchestrator } from "../../agents/orchestrator/src/ask.js";
import type { AskEvent } from "../../agents/orchestrator/src/events.js";
import { createGeminiRouter } from "../../agents/orchestrator/src/gemini.js";
import { countRows, loadFixture } from "./helpers.js";

/*
  The whole chain, for real except the two AI calls:
    orchestrator -> finds the agent through its agent card -> sends the question over A2A (JSON-RPC)
    -> analyst executor -> runReadOnly on the test database as analyst_ro -> answer back to the orchestrator.
  The analyst's model and the orchestrator's router are fakes, so the test decides which SQL "the AI" writes.
*/
vi.mock("../../agents/analyst/src/gemini.js", () => ({ createGeminiModel: vi.fn() }));
vi.mock("../../agents/orchestrator/src/gemini.js", () => ({ createGeminiRouter: vi.fn() }));

const model = { writeSql: vi.fn(), explain: vi.fn() };
const router = { route: vi.fn() };

// A port nothing is using (start a server on port 0, see which port it got, stop it)
async function freePort(): Promise<number> {
  const probe: Server = createServer();
  await new Promise<void>((resolve) => probe.listen(0, resolve));
  const { port } = probe.address() as { port: number };
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

let agent: HttpServer;
let agentUrl: string;

beforeAll(async () => {
  vi.spyOn(console, "log").mockImplementation(() => {}); // the agent server announces itself
  const port = await freePort();
  agentUrl = `http://localhost:${port}`;
  const card = createAgentCard({
    name: "Koll Analyst",
    description: "Answers questions about your spending.",
    port,
    skills: [
      {
        id: "ask",
        name: "Answer",
        description: "Answers spending questions.",
        examples: ["Hur mycket la jag?"],
      },
    ],
  });
  agent = startAgentServer(card, new AnalystExecutor(), port);
  await new Promise((resolve) => agent.once("listening", resolve));
});

afterAll(async () => {
  agent.closeAllConnections();
  await new Promise((resolve) => agent.close(resolve));
  await pool.end();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("AGENT_URLS", agentUrl);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(createGeminiModel).mockReturnValue(model);
  vi.mocked(createGeminiRouter).mockReturnValue(router);
  router.route.mockResolvedValue({
    agent: "Koll Analyst",
    message: "Hur mycket har jag spenderat?",
    reason: "En fråga om utgifter.",
  });
  model.explain.mockResolvedValue("Du spenderade 9 867 kr.");
});

afterEach(() => {
  vi.unstubAllEnvs();
  model.writeSql.mockReset();
  model.explain.mockReset();
  router.route.mockReset();
});

async function ask(question: string): Promise<AskEvent[]> {
  const events: AskEvent[] = [];
  for await (const event of askOrchestrator(question)) events.push(event);
  return events;
}

describe("a question travelling through the whole chain", () => {
  it("finds the agent, runs the SQL on the database, and brings SQL, rows and answer back", async () => {
    await loadFixture();
    const sql = "SELECT -SUM(amount) AS total FROM transactions WHERE amount < 0";
    model.writeSql.mockResolvedValue(sql);

    const events = await ask("Hur mycket spenderade jag totalt?");

    expect(events).toEqual([
      { type: "agents", names: ["Koll Analyst"] },
      { type: "route", agent: "Koll Analyst", reason: "En fråga om utgifter." },
      { type: "sql", sql },
      { type: "rows", rows: [{ total: 9867.25 }] }, // exact, and a number again after the trip
      { type: "answer", text: "Du spenderade 9 867 kr." },
    ]);
  });

  it("gives the agent the router's message, and the AI the real rows from the database", async () => {
    await loadFixture();
    model.writeSql.mockResolvedValue("SELECT count(*)::int AS n FROM transactions");

    await ask("något annat än routerns text");

    expect(model.writeSql).toHaveBeenCalledWith("Hur mycket har jag spenderat?");
    expect(model.explain).toHaveBeenCalledWith("Hur mycket har jag spenderat?", expect.any(String), [
      { n: 20 },
    ]);
  });

  it("answers without a rows event when the query finds nothing", async () => {
    model.writeSql.mockResolvedValue("SELECT * FROM transactions");

    const events = await ask("hej");

    expect(events.map((e) => e.type)).toEqual(["agents", "route", "sql", "answer"]);
  });

  it("never reaches the agent when the router says no agent fits", async () => {
    router.route.mockResolvedValue({ agent: "none", message: "m", reason: "Inte en fråga om pengar." });

    const events = await ask("Vad blir vädret?");

    expect(events.map((e) => e.type)).toEqual(["agents", "route"]);
    expect(model.writeSql).not.toHaveBeenCalled();
  });
});

describe("when the AI writes bad SQL, the agent refuses and the data is safe", () => {
  it.each([
    ["a DELETE", "DELETE FROM transactions"],
    ["two statements", "SELECT 1; DROP TABLE transactions"],
    ["a DELETE hidden in a WITH", "WITH g AS (DELETE FROM transactions RETURNING *) SELECT * FROM g"],
  ])("%s", async (_name, sql) => {
    await loadFixture();
    model.writeSql.mockResolvedValue(sql);

    const events = await ask("hej");

    // The visitor gets a general message. SQL and rows are not passed on, and the AI is not asked to explain.
    expect(events).toEqual([
      { type: "agents", names: ["Koll Analyst"] },
      { type: "route", agent: "Koll Analyst", reason: "En fråga om utgifter." },
      { type: "answer", text: "Jag kunde inte svara på den frågan. Försök igen." },
    ]);
    expect(model.explain).not.toHaveBeenCalled();
    expect(await countRows("transactions")).toBe(20);
  });

  it("tells the visitor when the daily limit is reached, without internal details", async () => {
    model.writeSql.mockRejectedValue(
      new Error("Daily Gemini limit reached (100 calls). Raise GEMINI_DAILY_LIMIT in .env."),
    );

    const events = await ask("hej");

    expect(events.at(-1)).toEqual({
      type: "answer",
      text: "Dagens gräns för AI-anrop är nådd. Försök igen imorgon.",
    });
  });

  it("never shows the visitor technical details, only the server log gets them", async () => {
    const log = vi.spyOn(console, "error");
    model.writeSql.mockRejectedValue(new Error("connect ECONNREFUSED db:5432 (project koll-123456)"));

    const events = await ask("hej");

    const answer = events.at(-1) as { text: string };
    expect(answer.text).toBe("Jag kunde inte svara på den frågan. Försök igen.");
    expect(JSON.stringify(events)).not.toMatch(/ECONNREFUSED|db:5432|koll-123456/);
    expect(log).toHaveBeenCalledWith("[analyst]", "connect ECONNREFUSED db:5432 (project koll-123456)");
  });
});

describe("when no agent is running", () => {
  it("tells the visitor, and never asks the router", async () => {
    vi.stubEnv("AGENT_URLS", `http://localhost:${await freePort()}`); // nothing listens there

    expect(await ask("hej")).toEqual([
      { type: "error", text: "No agents are running right now. Start them and try again." },
    ]);
    expect(router.route).not.toHaveBeenCalled();
  });

  it("still works with the agents that are running when another one is down", async () => {
    vi.stubEnv("AGENT_URLS", `http://localhost:${await freePort()},${agentUrl}`);
    model.writeSql.mockResolvedValue("SELECT 1 AS x");

    const events = await ask("hej");

    expect(events[0]).toEqual({ type: "agents", names: ["Koll Analyst"] });
    expect(events.at(-1)).toMatchObject({ type: "answer" });
  });
});
