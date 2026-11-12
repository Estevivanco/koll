import { defineConfig, devices } from "@playwright/test";

/*
  End-to-end tests: a real browser opens the built website and clicks through it.
  Demo mode only (the default build): scripted answers on made-up data, no backend, no Gemini.

  Run:  npm run test:e2e
  See:  npx playwright test --ui    (from apps/web)
*/
const PORT = 4173;

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep the screenshots and traces of a failed run out of git
  outputDir: "./test-results",
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a stray test.only must not turn CI green
  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL: `http://localhost:${PORT}`,
    // mockAsk waits about 3 s per answer unless the visitor prefers reduced motion. Tests that
    // check the "busy" state switch this off with page.emulateMedia({ reducedMotion: "no-preference" }).
    reducedMotion: "reduce",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],

  // Tests run against the production build (what visitors get), not the dev server
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
