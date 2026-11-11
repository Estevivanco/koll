import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
  One test run, two environments ("projects"):
    - node: agents and packages. Plain Node, no browser.
    - web:  the website. jsdom is a pretend browser (document, window) that runs inside Node.
  Tests sit next to the code they test: rules.ts -> rules.test.ts.
*/
export default defineConfig({
  test: {
    // Remove this once there are real tests, so an empty or misconfigured run fails loudly
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["{agents,packages}/**/src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
