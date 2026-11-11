import { createAgentCard, createMessage, dataPart, textPart, readText } from "@koll/a2a";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverAgents, type KnownAgent } from "../src/agents.js";
import { askOrchestrator } from "../src/ask.js";
import type { AskEvent } from "../src/events.js";
import { createGeminiRouter } from "../src/gemini.js";

// Fakes: no running agents, no Gemini, no database
vi.mock("../src/agents.js", () => ({ discoverAgents: vi.fn() }));
vi.mock("../src/gemini.js", () => ({ createGeminiRouter: vi.fn() }));

const route = vi.fn();
const sendToAnalyst = vi.fn();
const sendToCategorizer = vi.fn();

function fakeAgent(name: string, sendMessage: typeof sendToAnalyst): KnownAgent {
  const card = createAgentCard({ name, description: `${name}.`, port: 4000, skills: [] });
  return { name, card, client: { sendMessage } } as unknown as KnownAgent;
}

const analyst = fakeAgent("Koll Analyst", sendToAnalyst);
const categorizer = fakeAgent("Koll Categorizer", sendToCategorizer);

async function collect(request: string): Promise<AskEvent[]> {
  const events: AskEvent[] = [];
  for await (const event of askOrchestrator(request)) events.push(event);
  return events;
}

const types = (events: AskEvent[]) => events.map((e) => e.type);

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.spyOn(console, "error").mockImplementation(() => {}); // friendlyError logs the technical message
  vi.mocked(discoverAgents).mockResolvedValue([categorizer, analyst]);
  vi.mocked(createGeminiRouter).mockReturnValue({ route });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  route.mockReset();
  sendToAnalyst.mockReset();
  sendToCategorizer.mockReset();
});

describe("askOrchestrator", () => {
  describe("a question an agent can answer", () => {
    beforeEach(() => {
      route.mockResolvedValue({
        agent: "Koll Analyst",
        message: "Hur mycket på mat?",
        reason: "A spending question.",
      });
      sendToAnalyst.mockResolvedValue(
        createMessage("agent", [
          textPart("Du spenderade 3 420 kr."),
          dataPart({ sql: "SELECT 1", rows: [{ total: "3420.00", category: "Mat", note: null }] }),
        ]),
      );
    });

    it("sends the events in order: agents, route, sql, rows, answer", async () => {
      const events = await collect("Hur mycket la jag på mat?");

      expect(events).toEqual([
        { type: "agents", names: ["Koll Categorizer", "Koll Analyst"] },
        { type: "route", agent: "Koll Analyst", reason: "A spending question." },
        { type: "sql", sql: "SELECT 1" },
        { type: "rows", rows: [{ total: 3420, category: "Mat", note: "–" }] },
        { type: "answer", text: "Du spenderade 3 420 kr." },
      ]);
    });

    it("asks the router with the original request and the agents it found", async () => {
      await collect("Hur mycket la jag på mat?");
      expect(route).toHaveBeenCalledWith("Hur mycket la jag på mat?", [categorizer, analyst]);
    });

    it("sends the router's message (not the original) to the chosen agent only", async () => {
      await collect("Hur mycket la jag på mat?");

      expect(sendToCategorizer).not.toHaveBeenCalled();
      expect(sendToAnalyst).toHaveBeenCalledOnce();
      expect(readText(sendToAnalyst.mock.calls[0][0].message)).toBe("Hur mycket på mat?");
    });
  });

  describe("replies without data", () => {
    it("sends just the answer when the agent gave no SQL or rows", async () => {
      route.mockResolvedValue({ agent: "Koll Categorizer", message: "Kategorisera 20", reason: "r" });
      sendToCategorizer.mockResolvedValue(createMessage("agent", [textPart("Categorized 20.")]));

      expect(types(await collect("Kategorisera 20"))).toEqual(["agents", "route", "answer"]);
    });

    it("skips the rows event when there are no rows", async () => {
      route.mockResolvedValue({ agent: "Koll Analyst", message: "m", reason: "r" });
      sendToAnalyst.mockResolvedValue(
        createMessage("agent", [textPart("Inga träffar."), dataPart({ sql: "SELECT 1", rows: [] })]),
      );

      expect(types(await collect("x"))).toEqual(["agents", "route", "sql", "answer"]);
    });
  });

  describe("no agent fits", () => {
    it('stops after the route when the router says "none"', async () => {
      route.mockResolvedValue({ agent: "none", message: "m", reason: "Not about transactions." });

      expect(await collect("Vad blir vädret?")).toEqual([
        { type: "agents", names: ["Koll Categorizer", "Koll Analyst"] },
        { type: "route", agent: "none", reason: "Not about transactions." },
      ]);
      expect(sendToAnalyst).not.toHaveBeenCalled();
      expect(sendToCategorizer).not.toHaveBeenCalled();
    });

    it("treats an agent name that does not exist as none", async () => {
      route.mockResolvedValue({ agent: "Koll Poet", message: "m", reason: "r" });

      const events = await collect("x");

      expect(events.at(-1)).toEqual({ type: "route", agent: "none", reason: "r" });
      expect(types(events)).not.toContain("answer");
    });

    it("says so when no agent is running, and never asks the router", async () => {
      vi.mocked(discoverAgents).mockResolvedValue([]);

      expect(await collect("x")).toEqual([
        { type: "error", text: "No agents are running right now. Start them and try again." },
      ]);
      expect(route).not.toHaveBeenCalled();
    });
  });

  describe("errors become events, never exceptions", () => {
    it("turns a router failure into an error event, after the agents event", async () => {
      route.mockRejectedValue(new Error("Daily Gemini limit reached"));

      expect(await collect("x")).toEqual([
        { type: "agents", names: ["Koll Categorizer", "Koll Analyst"] },
        { type: "error", text: "Today's limit for AI calls is reached. Try again tomorrow." },
      ]);
    });

    it("turns an unknown AI_PROVIDER into an error event", async () => {
      vi.stubEnv("AI_PROVIDER", "skynet");

      const events = await collect("x");

      expect(events.at(-1)).toEqual({
        type: "error",
        text: "Something went wrong while answering. Try again.",
      });
    });

    it("turns a failing agent into an error event, after the route event", async () => {
      route.mockResolvedValue({ agent: "Koll Analyst", message: "m", reason: "r" });
      sendToAnalyst.mockRejectedValue(new Error("request timed out"));

      const events = await collect("x");

      expect(types(events)).toEqual(["agents", "route", "error"]);
      expect(events.at(-1)).toEqual({
        type: "error",
        text: "Gemini didn't answer in time. Try again in a moment.",
      });
    });

    it("turns a reply that is not a message (a task) into an error event", async () => {
      route.mockResolvedValue({ agent: "Koll Analyst", message: "m", reason: "r" });
      sendToAnalyst.mockResolvedValue({ id: "task-1", status: "working" });

      expect((await collect("x")).at(-1)).toEqual({
        type: "error",
        text: "The agent answered in an unexpected way.",
      });
    });
  });
});
