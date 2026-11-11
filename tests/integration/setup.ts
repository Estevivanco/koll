import { afterAll, beforeEach } from "vitest";
import { admin } from "./helpers.js";

/*
  Runs before every integration test file. Empties both tables before each test, so tests
  can't affect each other. Uses the owner login: the limited logins are what the tests examine.
*/
beforeEach(async () => {
  await admin.query("TRUNCATE transactions, gemini_usage");
});

afterAll(async () => {
  await admin.end();
});
