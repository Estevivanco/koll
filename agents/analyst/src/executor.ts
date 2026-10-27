import {
  AgentEvent,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from "@a2a-js/sdk/server";
import { createMessage, dataPart, readText, textPart } from "@koll/a2a";
import { answerQuestion } from "./answer.js";

export class AnalystExecutor implements AgentExecutor {
  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const question = readText(context.userMessage);

    let reply;
    try {
      const { answer, sql, rows } = await answerQuestion(question);
      // Send the SQL and rows too, so the caller can show how the answer was found
      reply = createMessage("agent", [textPart(answer), dataPart({ sql, rows })], context.contextId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      reply = createMessage("agent", [textPart(`Jag kunde inte svara: ${reason}`)], context.contextId);
    }

    eventBus.publish(AgentEvent.message(reply));
  }

  async cancelTask(): Promise<void> {}
}