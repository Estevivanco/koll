import {
  AgentEvent,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from "@a2a-js/sdk/server";
import { createMessage, dataPart, readText, textPart } from "@koll/a2a";
import { categorizeBatch } from "./categorize.js";

// Runs every time another agent sends this agent a message
export class CategorizerExecutor implements AgentExecutor {
  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    // Read the text the other agent sent, e.g. "Kategorisera 20"
    const text = readText(context.userMessage);
    const limit = Number(text.match(/\d+/)?.[0] ?? 50);

    const summary = await categorizeBatch(limit);

    // Answer with two parts: a sentence for humans, and the data for code
    const reply = createMessage(
      "agent",
      [
        textPart(`Categorized ${summary.total}: ${summary.fromRules} by rules, ${summary.fromAi} by AI.`),
        dataPart(summary),
      ],
      context.contextId,
    );
    eventBus.publish(AgentEvent.message(reply));
  }

  // Required by the interface. Our work is quick, so there's nothing to cancel.
  async cancelTask(): Promise<void> {}
}