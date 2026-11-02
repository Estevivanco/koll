import { askOrchestrator } from "./ask.js";

// Ask from the terminal. Uses exactly the same steps as the website (ask.ts).
const request = process.argv.slice(2).join(" ");
if (!request) {
  console.error(
    'Usage: npx tsx --env-file=.env agents/orchestrator/src/index.ts "Hur mycket la jag på mat i september?"',
  );
  process.exit(1);
}

for await (const event of askOrchestrator(request)) {
  switch (event.type) {
    case "agents":
      console.log(`Agents found: ${event.names.join(", ")}`);
      break;
    case "route":
      if (event.agent === "none") console.log(`\nNo agent can handle that. ${event.reason}`);
      else console.log(`→ ${event.agent}\n  Why: ${event.reason}\n`);
      break;
    case "sql":
      console.log(`SQL:\n${event.sql}\n`);
      break;
    case "rows":
      console.table(event.rows);
      break;
    case "answer":
      console.log(`\n${event.text}`);
      break;
    case "notice":
      console.log(event.text);
      break;
    case "error":
      console.error(`! ${event.text}`);
      process.exitCode = 1;
      break;
  }
}
