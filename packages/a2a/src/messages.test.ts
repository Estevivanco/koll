import { Role } from "@a2a-js/sdk";
import { describe, expect, it } from "vitest";
import { createMessage, dataPart, readData, readText, textPart } from "./messages.js";

describe("text", () => {
  it("comes back out the way it went in", () => {
    expect(readText(createMessage("user", [textPart("Hej, hur mycket spenderade jag?")]))).toBe(
      "Hej, hur mycket spenderade jag?",
    );
  });

  it("joins several text parts with a new line", () => {
    expect(readText(createMessage("agent", [textPart("rad ett"), textPart("rad två")]))).toBe(
      "rad ett\nrad två",
    );
  });

  it("skips empty text and data parts", () => {
    const message = createMessage("agent", [textPart(""), dataPart({ a: 1 }), textPart("kvar")]);
    expect(readText(message)).toBe("kvar");
  });

  it("is an empty string when there is no text", () => {
    expect(readText(createMessage("agent", []))).toBe("");
  });
});

describe("data", () => {
  it("comes back out the way it went in", () => {
    const rows = [{ category: "Mat", spent: 100 }];
    expect(readData(createMessage("agent", [dataPart(rows)]))).toEqual(rows);
  });

  it("returns the first data part when there are several", () => {
    expect(readData(createMessage("agent", [dataPart(1), dataPart(2)]))).toBe(1);
  });

  it("finds the data part after a text part", () => {
    expect(readData(createMessage("agent", [textPart("hej"), dataPart({ ok: true })]))).toEqual({ ok: true });
  });

  it("is undefined when there is no data part", () => {
    expect(readData(createMessage("agent", [textPart("bara text")]))).toBeUndefined();
  });
});

describe("createMessage", () => {
  it("sets the role", () => {
    expect(createMessage("user", []).role).toBe(Role.ROLE_USER);
    expect(createMessage("agent", []).role).toBe(Role.ROLE_AGENT);
  });

  it("gives every message its own id", () => {
    expect(createMessage("user", []).messageId).not.toBe(createMessage("user", []).messageId);
  });

  it("keeps the context id, empty by default", () => {
    expect(createMessage("user", [], "ctx-1").contextId).toBe("ctx-1");
    expect(createMessage("user", []).contextId).toBe("");
  });
});
