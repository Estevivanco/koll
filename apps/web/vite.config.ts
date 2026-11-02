import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In live mode the site calls /api/... on its own address, and Vite passes it on to the
    // orchestrator's server. Same address for both = no CORS setup needed.
    proxy: {
      "/api": process.env.KOLL_API_URL ?? "http://localhost:4000",
    },
  },
});
