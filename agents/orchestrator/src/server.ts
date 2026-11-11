import { createApp } from "./app.js";

// Starts the orchestrator's web server. The app itself is in app.ts.

// Not *_PORT: Kubernetes sets ORCHESTRATOR_PORT=tcp://... for a Service named "orchestrator"
const PORT = Number(process.env.KOLL_API_PORT ?? 4000);

createApp().listen(PORT, () => {
  console.log(`Koll API on http://localhost:${PORT}  (POST /api/ask, GET /api/health)`);
});
