import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
  One test run, two environments ("projects"):
    - node: agents and packages. Plain Node, no browser.
    - web:  the website. jsdom is a pretend browser (document, window) that runs inside Node.
  Tests sit in a tests/ folder next to src/, with the same file names: src/rules.ts -> tests/rules.test.ts.
*/
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["{agents,packages}/*/tests/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/tests/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
