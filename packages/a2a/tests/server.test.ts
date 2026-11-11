import type { AgentExecutor } from "@a2a-js/sdk/server";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentCard } from "../src/card.js";
import { startAgentServer } from "../src/server.js";

const card = createAgentCard({ name: "Koll Test", description: "A test agent.", port: 0, skills: [] });
const executor: AgentExecutor = { execute: async () => {}, cancelTask: async () => {} };

const servers: ReturnType<typeof startAgentServer>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
  vi.restoreAllMocks();
});

describe("startAgentServer", () => {
  it("starts on a free port when given port 0, and returns the server so it can be stopped", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const server = startAgentServer(card, executor, 0);
    servers.push(server);
    await new Promise((resolve) => server.once("listening", resolve));

    const { port } = server.address() as AddressInfo;
    expect(port).toBeGreaterThan(0);

    const res = await fetch(`http://localhost:${port}/.well-known/agent-card.json`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe("Koll Test");
  });

  it("prints the port it really got, not 0", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const server = startAgentServer(card, executor, 0);
    servers.push(server);
    await new Promise((resolve) => server.once("listening", resolve));

    const { port } = server.address() as AddressInfo;
    expect(log).toHaveBeenCalledWith(`Koll Test on http://localhost:${port}`);
  });

  it("stops listening when closed", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const server = startAgentServer(card, executor, 0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));

    await expect(fetch(`http://localhost:${port}/.well-known/agent-card.json`)).rejects.toThrow();
  });
});
