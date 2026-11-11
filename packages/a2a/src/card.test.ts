import { afterEach, describe, expect, it, vi } from "vitest";

// PUBLIC_HOST is read when card.ts is first loaded, so each test sets it and then loads a fresh copy
async function loadCard(host: string | undefined) {
  vi.resetModules();
  if (host === undefined) vi.stubEnv("PUBLIC_HOST", undefined);
  else vi.stubEnv("PUBLIC_HOST", host);
  return import("./card.js");
}

const input = {
  name: "Koll Test",
  description: "A test agent.",
  port: 4123,
  skills: [{ id: "s1", name: "Skill one", description: "Does one thing.", examples: ["ex"] }],
};

afterEach(() => vi.unstubAllEnvs());

describe("createAgentCard", () => {
  it("points at localhost when PUBLIC_HOST is not set", async () => {
    const { createAgentCard } = await loadCard(undefined);
    expect(createAgentCard(input).supportedInterfaces[0].url).toBe("http://localhost:4123/");
  });

  it("points at PUBLIC_HOST when it is set (Docker/Kubernetes service name)", async () => {
    const { createAgentCard } = await loadCard("categorizer");
    expect(createAgentCard(input).supportedInterfaces[0].url).toBe("http://categorizer:4123/");
  });

  it("keeps the name, description and skills", async () => {
    const { createAgentCard } = await loadCard(undefined);
    const card = createAgentCard(input);

    expect(card.name).toBe("Koll Test");
    expect(card.description).toBe("A test agent.");
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0]).toMatchObject({ id: "s1", name: "Skill one", examples: ["ex"] });
  });

  it("fills in the fields the agents never set", async () => {
    const { createAgentCard } = await loadCard(undefined);
    const [skill] = createAgentCard(input).skills;

    expect(skill.tags).toEqual([]);
    expect(skill.inputModes).toEqual(["text/plain"]);
  });
});
