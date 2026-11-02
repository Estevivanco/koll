import type { Ask, AskEvent } from "./types";

/*
  Live mode: asks the real orchestrator (POST /api/ask) and yields its events as they arrive.
  The server sends NDJSON: one JSON event per line. A chunk from the network can end in the
  middle of a line, so we keep the unfinished part in a buffer until the rest arrives.
*/
export const liveAsk: Ask = async function* (question: string): AsyncGenerator<AskEvent> {
  let response: Response;
  try {
    response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
  } catch {
    yield { type: "error", text: "Can't reach the Koll server. Is it running? (npm run api)" };
    return;
  }

  // Refused before it started (empty question, too long, too many questions): the server sends { error }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    yield { type: "error", text: body.error ?? `The server answered with status ${response.status}.` };
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as AskEvent;
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AskEvent;
};
