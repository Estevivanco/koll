import { readFile } from "node:fs/promises";
import type { AgentCard } from "@a2a-js/sdk";
import { createGeminiRouter } from "../src/gemini.js";
import type { AgentInfo, Router } from "../src/router.js";

// Router eval: does the orchestrator pick the right agent?
// Run with the agents running (docker compose up -d):
//   npx tsx --env-file=.env agents/orchestrator/evals/router.eval.ts
// Each case = 1 Gemini call.

type Case = { request: string; expected: string };
type Result = Case & { got: string; reason: string; ok: boolean };

// Below this, the script exits with an error (useful later in CI)
const MIN_ACCURACY = 0.9;

const AGENT_URLS = (process.env.AGENT_URLS ?? "http://localhost:4001,http://localhost:4002")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

// Read the agent cards straight from the agents: exactly what the real router sees
async function loadAgents(): Promise<AgentInfo[]> {
  return Promise.all(
    AGENT_URLS.map(async (url) => {
      const response = await fetch(new URL("/.well-known/agent-card.json", url));
      if (!response.ok) throw new Error(`No agent card at ${url}. Are the agents running?`);
      const card = (await response.json()) as AgentCard;
      return { name: card.name, card };
    }),
  );
}

function createRouter(): Router {
  switch (process.env.AI_PROVIDER) {
    case "gemini":
      return createGeminiRouter();
    default:
      throw new Error(`Unknown AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  }
}

const cases = JSON.parse(await readFile(new URL("./router-cases.json", import.meta.url), "utf8")) as Case[];
// Optional: only run cases whose request contains this text, e.g. ONLY="mat"
const only = process.env.ONLY?.toLowerCase();
const selected = only ? cases.filter((c) => c.request.toLowerCase().includes(only)) : cases;
const agents = await loadAgents();
const router = createRouter();

console.log(`Agents: ${agents.map((a) => a.name).join(", ")}`);
console.log(`Running ${selected.length} cases…\n`);

// One at a time, so the output is readable and we don't hit rate limits
const results: Result[] = [];
// Cases where Gemini failed (timeout, 504...). They say nothing about routing, so they are not scored
const errors: { request: string; message: string }[] = [];
for (const c of selected) {
  const started = Date.now();
  let route;
  try {
    route = await router.route(c.request, agents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ request: c.request, message });
    console.log(
      `! ${c.request}  (${((Date.now() - started) / 1000).toFixed(1)} s)\n    Gemini error: ${message.slice(0, 120)}`,
    );
    continue;
  }
  const result = {
    ...c,
    got: route.agent,
    reason: route.reason,
    ok: route.agent === c.expected,
  };
  results.push(result);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${result.ok ? "✓" : "✗"} ${c.request}  (${seconds} s)`);
  if (!result.ok) console.log(`    expected ${c.expected}, got ${route.agent}. Why: ${route.reason}`);
}

// Score
const passed = results.filter((r) => r.ok).length;
const accuracy = passed / results.length;
console.log(`\nAccuracy: ${passed}/${results.length} (${Math.round(accuracy * 100)}%)`);
if (errors.length > 0)
  console.log(`${errors.length} case(s) not scored because Gemini failed. Run again to cover them.`);

// Mix-ups: which expected answer most often became which wrong answer
const mixups = new Map<string, number>();
for (const r of results.filter((r) => !r.ok)) {
  const key = `${r.expected} → ${r.got}`;
  mixups.set(key, (mixups.get(key) ?? 0) + 1);
}
if (mixups.size > 0) {
  console.log("\nMix-ups:");
  for (const [key, count] of [...mixups].sort((a, b) => b[1] - a[1])) console.log(`  ${count}× ${key}`);
}

// Too many Gemini errors means the run can't be trusted, even if every scored case passed
const MAX_ERROR_SHARE = 0.1;
const errorShare = errors.length / selected.length;

if (results.length === 0 || accuracy < MIN_ACCURACY || errorShare > MAX_ERROR_SHARE) {
  if (errorShare > MAX_ERROR_SHARE) {
    console.error(
      `\n${errors.length} of ${selected.length} cases failed on Gemini errors (max ${MAX_ERROR_SHARE * 100}%).`,
    );
  } else {
    console.error(`\nBelow the ${MIN_ACCURACY * 100}% target.`);
  }
  process.exit(1);
}
