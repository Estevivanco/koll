import { Role, type Message, type Part } from "@a2a-js/sdk";

// A2A messages need many fields we never use. These helpers fill them in,
// so agents only write what matters: the text and the data.

export function textPart(text: string): Part {
  return {
    content: { $case: "text", value: text },
    metadata: undefined,
    filename: "",
    mediaType: "text/plain",
  };
}

export function dataPart(data: unknown): Part {
  return {
    content: { $case: "data", value: data },
    metadata: undefined,
    filename: "",
    mediaType: "application/json",
  };
}

export function createMessage(role: "user" | "agent", parts: Part[], contextId = ""): Message {
  return {
    messageId: crypto.randomUUID(),
    contextId,
    taskId: "",
    role: role === "user" ? Role.ROLE_USER : Role.ROLE_AGENT,
    parts,
    metadata: {},
    extensions: [],
    referenceTaskIds: [],
  };
}

// All text parts of a message, joined into one string
export function readText(message: Message): string {
  return message.parts
    .map((part) => (part.content?.$case === "text" ? part.content.value : ""))
    .filter(Boolean)
    .join("\n");
}

// The first data part of a message, or undefined if there is none
export function readData(message: Message): unknown {
  const part = message.parts.find((p) => p.content?.$case === "data");
  return part?.content?.$case === "data" ? part.content.value : undefined;
}
