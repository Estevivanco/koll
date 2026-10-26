import { Role, type Message } from "@a2a-js/sdk";
import {
  AgentEvent,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from "@a2a-js/sdk/server";
import { categorizeBatch } from "./categorize.js";

// Runs every time another agent sends this agent a message
export class CategorizerExecutor implements AgentExecutor {
  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    // Read the text the other agent sent, e.g. "Kategorisera 20"
    const text = context.userMessage.parts
      .map((part) => (part.content?.$case === "text" ? part.content.value : ""))
      .join(" ");
    const limit = Number(text.match(/\d+/)?.[0] ?? 50);

    const summary = await categorizeBatch(limit);

    // Answer with two parts: a sentence for humans, and the data for code
    const reply: Message = {
      messageId: crypto.randomUUID(),
      contextId: context.contextId,
      taskId: "",
      role: Role.ROLE_AGENT,
      parts: [
        {
          content: {
            $case: "text",
            value: `Categorized ${summary.total}: ${summary.fromRules} by rules, ${summary.fromAi} by AI.`,
          },
          metadata: undefined,
          filename: "",
          mediaType: "text/plain",
        },
        {
          content: { $case: "data", value: summary },
          metadata: undefined,
          filename: "",
          mediaType: "application/json",
        },
      ],
      metadata: {},
      extensions: [],
      referenceTaskIds: [],
    };

    eventBus.publish(AgentEvent.message(reply));
  }

  // Required by the interface. Our work is quick, so there's nothing to cancel.
  async cancelTask(): Promise<void> {}
}