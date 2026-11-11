import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("mcp-server db.ts", () => {
  // It used to call process.exit(1) here, which would stop the whole test run
  it("throws, and does not exit the process, when ANALYST_DATABASE_URL is missing", async () => {
    vi.resetModules();
    vi.stubEnv("ANALYST_DATABASE_URL", "");
    const exit = vi.spyOn(process, "exit");

    await expect(import("../src/db.js")).rejects.toThrow("ANALYST_DATABASE_URL is not set");
    expect(exit).not.toHaveBeenCalled();
  });
});
