import type { Transaction } from "@koll/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categorizeBatch } from "../src/categorize.js";
import { getUncategorized, saveCategories } from "../src/db.js";
import { createGeminiProvider } from "../src/gemini.js";

// Fakes. The real db.ts needs DATABASE_URL and a running Postgres; the real gemini.ts would spend money.
vi.mock("../src/db.js", () => ({ getUncategorized: vi.fn(), saveCategories: vi.fn() }));
vi.mock("../src/gemini.js", () => ({ createGeminiProvider: vi.fn() }));

// What the fake AI is asked, and what it answers
const aiCategorize = vi.fn();

function tx(id: string, counterparty: string, spent: number): Transaction {
  return { id, date: "2026-10-01", amount: -spent, counterparty, description: "", source: "swedbank" };
}

// The first two match a rule (CSN, CHUBB); the other two match none
const csn = tx("rule-1", "CSN", 3000);
const chubb = tx("rule-2", "CHUBB", 200);
const unknownA = tx("ai-1", "OKÄND BUTIK A", 80);
const unknownB = tx("ai-2", "OKÄND BUTIK B", 90);

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.mocked(createGeminiProvider).mockReturnValue({ categorize: aiCategorize });
  vi.mocked(saveCategories).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  aiCategorize.mockReset();
});

describe("categorizeBatch", () => {
  it("does nothing when there is nothing to categorize", async () => {
    vi.mocked(getUncategorized).mockResolvedValue([]);

    expect(await categorizeBatch(20)).toEqual({ total: 0, fromRules: 0, fromAi: 0, rows: [] });
    expect(createGeminiProvider).not.toHaveBeenCalled();
    expect(saveCategories).not.toHaveBeenCalled();
  });

  it("does not call the AI when the rules cover everything", async () => {
    vi.mocked(getUncategorized).mockResolvedValue([csn, chubb]);

    const summary = await categorizeBatch(20);

    expect(createGeminiProvider).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ total: 2, fromRules: 2, fromAi: 0 });
    expect(saveCategories).toHaveBeenCalledWith([
      { id: "rule-1", category: "Studiemedel" },
      { id: "rule-2", category: "Prenumeration" },
    ]);
  });

  it("sends only what the rules did not match to the AI", async () => {
    vi.mocked(getUncategorized).mockResolvedValue([csn, unknownA, unknownB]);
    aiCategorize.mockResolvedValue([
      { id: "ai-1", category: "Mat" },
      { id: "ai-2", category: "Shopping" },
    ]);

    await categorizeBatch(20);

    expect(aiCategorize).toHaveBeenCalledWith([unknownA, unknownB]);
  });

  it("counts, saves and reports the mix of rules and AI", async () => {
    vi.mocked(getUncategorized).mockResolvedValue([csn, unknownA, unknownB]);
    aiCategorize.mockResolvedValue([
      { id: "ai-1", category: "Mat" },
      { id: "ai-2", category: "Shopping" },
    ]);

    const summary = await categorizeBatch(20);

    expect(summary.total).toBe(3);
    expect(summary.fromRules).toBe(1);
    expect(summary.fromAi).toBe(2);
    // Saved: rule results first, then the AI's
    expect(saveCategories).toHaveBeenCalledWith([
      { id: "rule-1", category: "Studiemedel" },
      { id: "ai-1", category: "Mat" },
      { id: "ai-2", category: "Shopping" },
    ]);
    // Reported in the original order, with each one's category
    expect(summary.rows).toEqual([
      { counterparty: "CSN", amount: -3000, category: "Studiemedel" },
      { counterparty: "OKÄND BUTIK A", amount: -80, category: "Mat" },
      { counterparty: "OKÄND BUTIK B", amount: -90, category: "Shopping" },
    ]);
  });

  it('reports "(missing)" when the AI skipped a transaction', async () => {
    vi.mocked(getUncategorized).mockResolvedValue([unknownA, unknownB]);
    aiCategorize.mockResolvedValue([{ id: "ai-1", category: "Mat" }]);

    const summary = await categorizeBatch(20);

    expect(summary.rows.map((r) => r.category)).toEqual(["Mat", "(missing)"]);
  });

  describe("batch size", () => {
    beforeEach(() => vi.mocked(getUncategorized).mockResolvedValue([]));

    it("asks for as many as were requested", async () => {
      await categorizeBatch(20);
      expect(getUncategorized).toHaveBeenCalledWith(20);
    });

    it("never asks for more than 200 (cost and Gemini's size limit)", async () => {
      await categorizeBatch(100000);
      expect(getUncategorized).toHaveBeenCalledWith(200);
      await categorizeBatch(200);
      expect(getUncategorized).toHaveBeenLastCalledWith(200);
    });
  });

  describe("when something goes wrong", () => {
    it("saves nothing and throws when the AI fails", async () => {
      vi.mocked(getUncategorized).mockResolvedValue([csn, unknownA]);
      aiCategorize.mockRejectedValue(new Error("Daily Gemini limit reached"));

      await expect(categorizeBatch(20)).rejects.toThrow("Daily Gemini limit reached");
      expect(saveCategories).not.toHaveBeenCalled();
    });

    it("throws on an unknown AI_PROVIDER, but only when the AI is needed", async () => {
      vi.stubEnv("AI_PROVIDER", "skynet");

      vi.mocked(getUncategorized).mockResolvedValue([csn]);
      await expect(categorizeBatch(20)).resolves.toMatchObject({ fromRules: 1 });

      vi.mocked(getUncategorized).mockResolvedValue([unknownA]);
      await expect(categorizeBatch(20)).rejects.toThrow("Unknown AI_PROVIDER: skynet");
    });
  });
});
