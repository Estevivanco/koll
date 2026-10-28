import { useCallback, useRef, useState } from "react";
import { MAX_QUESTION_LENGTH, type Ask, type AskEvent } from "../../api";

export type Entry = {
  id: number;
  question: string;
  events: AskEvent[];
  running: boolean;
};

function patchEntry(entries: Entry[], id: number, change: (entry: Entry) => Entry): Entry[] {
  return entries.map((entry) => (entry.id === id ? change(entry) : entry));
}

/** Holds the terminal's history and runs one question at a time */
export function useTerminal(ask: Ask) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  // A ref, not state, so a second click in the same instant is ignored immediately
  const busyRef = useRef(false);
  const nextId = useRef(1);

  const submit = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, MAX_QUESTION_LENGTH);
      if (!question || busyRef.current) return;

      if (question.toLowerCase() === "clear") {
        setEntries([]);
        return;
      }

      const id = nextId.current++;
      setEntries((prev) => [...prev, { id, question, events: [], running: true }]);
      busyRef.current = true;
      setBusy(true);

      try {
        for await (const event of ask(question)) {
          setEntries((prev) => patchEntry(prev, id, (e) => ({ ...e, events: [...e.events, event] })));
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : "Something went wrong.";
        setEntries((prev) =>
          patchEntry(prev, id, (e) => ({ ...e, events: [...e.events, { type: "error", text }] })),
        );
      } finally {
        setEntries((prev) => patchEntry(prev, id, (e) => ({ ...e, running: false })));
        busyRef.current = false;
        setBusy(false);
      }
    },
    [ask],
  );

  return { entries, busy, submit };
}
