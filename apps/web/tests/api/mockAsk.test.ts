import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXAMPLE_QUESTIONS, type AskEvent } from "../../src/api";
import { mockAsk } from "../../src/api/mockAsk";

// mockAsk waits between steps so it feels real, and jsdom has no matchMedia. Pretend the visitor
// prefers reduced motion: then every pause is 0 ms and the tests run instantly.
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});

async function collect(question: string): Promise<AskEvent[]> {
  const events: AskEvent[] = [];
  for await (const event of mockAsk(question)) events.push(event);
  return events;
}

const types = (events: AskEvent[]) => events.map((e) => e.type);

describe("mockAsk", () => {
  it("always starts by listing the agents", async () => {
    const [first] = await collect("vad som helst");
    expect(first).toEqual({ type: "agents", names: ["Koll Categorizer", "Koll Analyst"] });
  });

  describe("questions it knows", () => {
    it("answers a spending question with SQL, rows and an answer, from the Analyst", async () => {
      const events = await collect("Hur mycket la jag på mat i september?");

      expect(types(events)).toEqual(["agents", "route", "sql", "rows", "answer"]);
      expect(events[1]).toMatchObject({ type: "route", agent: "Koll Analyst" });
    });

    it("answers a categorize request from the Categorizer, with rows but no SQL", async () => {
      const events = await collect("Kategorisera 20 transaktioner");

      expect(types(events)).toEqual(["agents", "route", "rows", "answer"]);
      expect(events[1]).toMatchObject({ agent: "Koll Categorizer" });
    });

    it("ignores upper and lower case", async () => {
      expect(types(await collect("KATEGORISERA allt"))).toContain("answer");
    });
  });

  describe("questions it does not know", () => {
    it("explains that demo mode is limited, for a question that looks like finance", async () => {
      const events = await collect("Vilken är min dyraste prenumeration?");

      expect(types(events)).toEqual(["agents", "route", "notice"]);
      expect(events[1]).toMatchObject({ agent: "Koll Analyst" });
    });

    it("routes a question that is not about money to none", async () => {
      const events = await collect("Vad blir vädret imorgon?");

      expect(types(events)).toEqual(["agents", "route"]);
      expect(events[1]).toMatchObject({ agent: "none" });
    });
  });

  // The example buttons on the website must all do something sensible in demo mode
  describe("the example questions on the website", () => {
    const [food, shops, categorize, weather] = EXAMPLE_QUESTIONS;

    it.each([food, shops, categorize])("%s gets a full answer", async (question) => {
      expect(types(await collect(question))).toContain("answer");
    });

    it("the weather question gets none", async () => {
      expect((await collect(weather))[1]).toMatchObject({ agent: "none" });
    });
  });
});
