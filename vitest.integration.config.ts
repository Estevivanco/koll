import { defineConfig } from "vitest/config";

/*
  Integration tests: they talk to a real (throwaway) Postgres in Docker, so Docker must be running.
  Run with: npm run test:integration
  Kept in its own config so that `npm test` stays fast and never needs Docker.
*/
export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts", "{agents,packages}/*/tests/integration/**/*.int.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // One shared database, so one test file at a time
    fileParallelism: false,
    // Starting Postgres takes a few seconds (longer the first time, while the image downloads)
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
