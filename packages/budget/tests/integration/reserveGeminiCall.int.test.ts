import { afterEach, describe, expect, it, vi } from "vitest";
import { admin } from "../../../../tests/integration/helpers.js";

// The daily Gemini call counter protects your Vertex AI budget, so it must hold even when
// several agents call at the same moment, and it must fail closed (no call) when it can't check.

// The limit is read once when the module loads, so each scenario loads its own fresh copy
async function loadBudget(limit: number) {
  vi.resetModules();
  vi.stubEnv("GEMINI_DAILY_LIMIT", String(limit));
  return (await import("../../src/index.js")).reserveGeminiCall;
}

async function callsToday(): Promise<number | undefined> {
  const { rows } = await admin.query(
    "SELECT calls FROM gemini_usage WHERE day = (now() AT TIME ZONE 'Europe/Stockholm')::date",
  );
  return rows[0]?.calls;
}

afterEach(() => vi.unstubAllEnvs());

describe("reserveGeminiCall", () => {
  it("lets calls through up to the limit, then refuses", async () => {
    const reserve = await loadBudget(3);

    await reserve();
    await reserve();
    await reserve();

    await expect(reserve()).rejects.toThrow("Daily Gemini limit reached (3 calls)");
  });

  it("does not count the refused calls", async () => {
    const reserve = await loadBudget(3);
    for (let i = 0; i < 3; i++) await reserve();

    await expect(reserve()).rejects.toThrow();
    await expect(reserve()).rejects.toThrow();

    expect(await callsToday()).toBe(3);
  });

  it("counts one per call", async () => {
    const reserve = await loadBudget(10);

    await reserve();
    expect(await callsToday()).toBe(1);
    await reserve();
    expect(await callsToday()).toBe(2);
  });

  // The important one: many callers at the same instant must not squeeze past the last slots.
  // Three copies of the module = three separate pools, like three agents in separate processes.
  it("lets exactly the limit through when many calls arrive at once", async () => {
    const reserves = [await loadBudget(10), await loadBudget(10), await loadBudget(10)];

    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => reserves[i % 3]()));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(10);
    expect(await callsToday()).toBe(10);
  });

  it("starts from zero on a new day", async () => {
    const reserve = await loadBudget(3);
    // Yesterday's counter is full. Today's is a new row.
    await admin.query(
      "INSERT INTO gemini_usage VALUES ((now() AT TIME ZONE 'Europe/Stockholm')::date - 1, 3)",
    );

    await expect(reserve()).resolves.toBeUndefined();

    expect(await callsToday()).toBe(1);
  });

  describe("fails closed: no call when the counter can't be checked", () => {
    it("refuses when the database can't be reached", async () => {
      vi.stubEnv("BUDGET_DATABASE_URL", "postgres://budget_rw:x@127.0.0.1:1/koll_test"); // nothing listens on port 1
      const reserve = await loadBudget(10);

      await expect(reserve()).rejects.toThrow("Could not check the daily Gemini limit");
    });

    it("refuses when the password is wrong", async () => {
      vi.stubEnv("BUDGET_DATABASE_URL", process.env.BUDGET_DATABASE_URL!.replace("budget-pw", "wrong"));
      const reserve = await loadBudget(10);

      await expect(reserve()).rejects.toThrow("Could not check the daily Gemini limit");
    });

    it("refuses when no database URL is set", async () => {
      vi.stubEnv("BUDGET_DATABASE_URL", "");
      const reserve = await loadBudget(10);

      await expect(reserve()).rejects.toThrow(
        /Could not check the daily Gemini limit.*BUDGET_DATABASE_URL is not set/,
      );
    });
  });
});
