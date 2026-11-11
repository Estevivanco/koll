// What the visitor sees when the analyst can't answer. The technical message (which can contain
// hostnames, project names or SQL details) goes to the server log, never to the visitor.
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[analyst]", message);

  if (message.includes("Daily Gemini limit reached")) {
    return "Dagens gräns för AI-anrop är nådd. Försök igen imorgon.";
  }
  // Before the timeout check: this message ends with the database's own error, which can say "timeout"
  if (message.includes("Could not check the daily Gemini limit")) {
    return "AI:n är pausad eftersom användningsräknaren inte kan nås.";
  }
  if (/timeout|timed out|abort|DEADLINE_EXCEEDED|504/i.test(message)) {
    return "Gemini svarade inte i tid. Försök igen om en stund.";
  }
  return "Jag kunde inte svara på den frågan. Försök igen.";
}
