import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, parseTrustProxy } from "../src/app.js";
import type { AskEvent } from "../src/events.js";

// The web server's rules (what is refused, how often, how answers stream) with a fake "ask":
// no agents, no Gemini and no database are involved.

const servers: Server[] = [];

function start(options: Parameters<typeof createApp>[0]) {
  const server = createApp(options).listen(0);
  servers.push(server);
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;
  return {
    url,
    post: (body: unknown, init: RequestInit = {}) =>
      fetch(`${url}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
        ...init,
      }),
  };
}

// A fake ask that answers straight away
function fakeAsk(...events: AskEvent[]) {
  return vi.fn<(question: string) => AsyncGenerator<AskEvent>>(async function* () {
    yield* events;
  });
}

const lines = async (res: Response) =>
  (await res.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as AskEvent);

afterEach(() => {
  vi.restoreAllMocks();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

describe("GET /api/health", () => {
  it("says ok", async () => {
    const { url } = start({ ask: fakeAsk() });
    expect(await (await fetch(`${url}/api/health`)).json()).toEqual({ ok: true });
  });
});

describe("POST /api/ask: refused before anything costs money", () => {
  it.each([
    ["no question", {}],
    ["an empty question", { question: "" }],
    ["a question of only spaces", { question: "   \n " }],
    ["a question that is not text", { question: 42 }],
    ["a body that is not an object", "[1, 2]"],
  ])("answers 400 for %s", async (_name, body) => {
    const ask = fakeAsk();
    const res = await start({ ask }).post(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Write a question first." });
    expect(ask).not.toHaveBeenCalled();
  });

  it("answers 400 for a question over 200 characters", async () => {
    const ask = fakeAsk();
    const res = await start({ ask }).post({ question: "a".repeat(201) });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Questions can be at most 200 characters." });
    expect(ask).not.toHaveBeenCalled();
  });

  it("accepts a question of exactly 200 characters", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const res = await start({ ask }).post({ question: "a".repeat(200) });

    expect(res.status).toBe(200);
    expect(ask).toHaveBeenCalledOnce();
  });

  it("refuses a body bigger than 2 KB without reading it", async () => {
    const ask = fakeAsk();
    const res = await start({ ask }).post({ question: "a".repeat(3000) });

    expect(res.status).toBe(413);
    expect(ask).not.toHaveBeenCalled();
  });

  it("refuses a body that is not valid JSON", async () => {
    const ask = fakeAsk();
    const res = await start({ ask }).post("{not json");

    expect(res.status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it("trims the question before using it", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    await (await start({ ask }).post({ question: "  Hur mycket?  " })).text();

    expect(ask).toHaveBeenCalledWith("Hur mycket?");
  });
});

describe("POST /api/ask: the hourly limit", () => {
  it("answers 429 once a visitor has used up the limit, without calling ask", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 2 });

    expect((await post({ question: "ett" })).status).toBe(200);
    expect((await post({ question: "två" })).status).toBe(200);
    const third = await post({ question: "tre" });

    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: "That's 2 questions this hour. Try again later." });
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("does not count questions that were refused for being empty or too long", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 1 });

    for (let i = 0; i < 5; i++) await post({ question: "" });
    await post({ question: "a".repeat(201) });

    expect((await post({ question: "en riktig fråga" })).status).toBe(200);
  });

  it("can't be dodged by sending a made-up X-Forwarded-For header", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 1 });

    await post({ question: "ett" });
    const res = await post(
      { question: "två" },
      { headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.7" } },
    );

    expect(res.status).toBe(429);
  });

  it("lets the visitor ask again an hour later", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 1 });
    const realNow = Date.now;
    let offset = 0;
    vi.spyOn(Date, "now").mockImplementation(() => realNow() + offset);

    expect((await post({ question: "ett" })).status).toBe(200);
    expect((await post({ question: "två" })).status).toBe(429);

    offset = 61 * 60 * 1000;
    expect((await post({ question: "tre" })).status).toBe(200);
  });

  it("keeps a separate limit for every app, so state is not shared between servers", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const a = start({ ask, limitPerHour: 1 });
    const b = start({ ask, limitPerHour: 1 });

    await a.post({ question: "ett" });

    expect((await a.post({ question: "två" })).status).toBe(429);
    expect((await b.post({ question: "två" })).status).toBe(200);
  });
});

describe("POST /api/ask: the answer", () => {
  it("streams the events as NDJSON, in order, one per line", async () => {
    const events: AskEvent[] = [
      { type: "agents", names: ["Koll Analyst"] },
      { type: "route", agent: "Koll Analyst", reason: "En fråga om utgifter." },
      { type: "sql", sql: "SELECT 1" },
      { type: "rows", rows: [{ total: 1 }] },
      { type: "answer", text: "Ett." },
    ];
    const res = await start({ ask: fakeAsk(...events) }).post({ question: "hej" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await lines(res)).toEqual(events);
  });

  it("sends each event as soon as it happens, not all at the end", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const ask = vi.fn(async function* (): AsyncGenerator<AskEvent> {
      yield { type: "agents", names: ["Koll Analyst"] };
      await gate; // the rest has to wait
      yield { type: "answer", text: "klart" };
    });

    const res = await start({ ask }).post({ question: "hej" });
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();

    // The first event arrives while the second is still being waited for
    const first = await reader.read();
    expect(JSON.parse(first.value!)).toEqual({ type: "agents", names: ["Koll Analyst"] });

    finish();
    expect(JSON.parse((await reader.read()).value!)).toEqual({ type: "answer", text: "klart" });
  });

  it("sends error events to the visitor like any other event", async () => {
    const res = await start({ ask: fakeAsk({ type: "error", text: "Något gick fel." }) }).post({
      question: "hej",
    });

    expect(res.status).toBe(200);
    expect(await lines(res)).toEqual([{ type: "error", text: "Något gick fel." }]);
  });

  it("stops asking for more when the visitor closes the page", async () => {
    let stopped = false;
    const ask = vi.fn(async function* (): AsyncGenerator<AskEvent> {
      try {
        for (let i = 0; ; i++) {
          yield { type: "notice", text: String(i) };
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      } finally {
        stopped = true;
      }
    });
    const controller = new AbortController();

    const res = await start({ ask }).post({ question: "hej" }, { signal: controller.signal });
    await res.body!.getReader().read(); // got the first event ...
    controller.abort(); // ... and then left

    await vi.waitFor(() => expect(stopped).toBe(true), { timeout: 2000 });
  });
});

describe("behind a proxy (TRUST_PROXY)", () => {
  const asVisitor = (address: string): RequestInit => ({
    headers: { "Content-Type": "application/json", "X-Forwarded-For": address },
  });

  it("gives every visitor their own limit when one proxy is trusted", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 1, trustProxy: 1 });

    expect((await post({ question: "a" }, asVisitor("203.0.113.1"))).status).toBe(200);
    expect((await post({ question: "b" }, asVisitor("203.0.113.1"))).status).toBe(429); // the same visitor
    expect((await post({ question: "c" }, asVisitor("203.0.113.2"))).status).toBe(200); // another visitor
  });

  it("is not fooled by a made-up address in front of the real one", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 1, trustProxy: 1 });

    // The proxy adds the real address last. Whatever the visitor puts first is ignored.
    expect((await post({ question: "a" }, asVisitor("1.1.1.1, 203.0.113.1"))).status).toBe(200);
    expect((await post({ question: "b" }, asVisitor("2.2.2.2, 203.0.113.1"))).status).toBe(429);
  });

  it("still ignores X-Forwarded-For when no proxy is trusted (the default)", async () => {
    const ask = fakeAsk({ type: "answer", text: "ok" });
    const { post } = start({ ask, limitPerHour: 1 });

    expect((await post({ question: "a" }, asVisitor("203.0.113.1"))).status).toBe(200);
    expect((await post({ question: "b" }, asVisitor("203.0.113.2"))).status).toBe(429);
  });
});

describe("parseTrustProxy", () => {
  it.each([
    [undefined, 0],
    ["", 0],
    ["  ", 0],
    ["0", 0],
    ["1", 1],
    [" 2 ", 2],
  ])("reads %j as %s", (value, expected) => {
    expect(parseTrustProxy(value)).toBe(expected);
  });

  it.each(["true", "false", "yes", "1.5", "-1", "loopback", "10.0.0.1"])("refuses %j", (value) => {
    expect(() => parseTrustProxy(value)).toThrow("TRUST_PROXY must be the number of proxies");
  });
});
