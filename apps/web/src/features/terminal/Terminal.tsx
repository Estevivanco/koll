import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { EXAMPLE_QUESTIONS, MAX_QUESTION_LENGTH, ask } from "../../api";
import { Section } from "../../components/layout/Section";
import { TerminalEntry } from "./TerminalEntry";
import { useTerminal } from "./useTerminal";
import styles from "./Terminal.module.css";

export function Terminal() {
  const { entries, busy, submit } = useTerminal(ask);
  const [draft, setDraft] = useState("");
  const windowRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const past = useRef<string[]>([]);
  const pastPosition = useRef<number | null>(null);

  // The first time the terminal scrolls into view it runs one example by itself,
  // so visitors see it work without having to click. Demo mode costs nothing.
  const autoplayed = useRef(false);
  useEffect(() => {
    const element = windowRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || autoplayed.current) return;
        autoplayed.current = true;
        observer.disconnect();
        past.current.push(EXAMPLE_QUESTIONS[0]);
        void submit(EXAMPLE_QUESTIONS[0]);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [submit]);

  // Keep the newest line in view
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [entries]);

  function run(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    past.current.push(trimmed);
    pastPosition.current = null;
    setDraft("");
    void submit(trimmed);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    run(draft);
  }

  // Arrow up/down walks through earlier questions, like a real terminal
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (past.current.length === 0) return;

    let position = pastPosition.current;
    if (event.key === "ArrowUp") {
      position = position === null ? past.current.length - 1 : Math.max(0, position - 1);
    } else if (position !== null) {
      position = position + 1 >= past.current.length ? null : position + 1;
    }
    pastPosition.current = position;
    setDraft(position === null ? "" : past.current[position]);
  }

  // Clicking anywhere in the window puts the cursor in the input (unless the visitor is selecting text)
  function focusInput() {
    if (window.getSelection()?.toString()) return;
    inputRef.current?.focus({ preventScroll: true });
  }

  return (
    <Section
      id="terminal"
      eyebrow="Try it"
      title="Ask in Swedish, watch the agents work"
      intro="Demo mode: scripted answers on made-up data. The steps are the real ones: find the agents, route the question, write read-only SQL, explain the result."
    >
      <div ref={windowRef} className={styles.window}>
        <div className={styles.titlebar} aria-hidden="true">
          <span className={styles.dots}>
            <span />
            <span />
            <span />
          </span>
          <span className={styles.title}>koll · demo mode</span>
        </div>

        {/* A click on the log only moves the cursor to the input; the input stays the way to type */}
        <div
          ref={logRef}
          className={styles.log}
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
          onClick={focusInput}
        >
          <p className={styles.welcome}>koll demo · made-up data, scripted answers</p>
          <p className={styles.hint}>
            Pick an example below or type your own question. Type &quot;clear&quot; to start over.
          </p>
          {entries.map((entry) => (
            <TerminalEntry key={entry.id} entry={entry} />
          ))}
        </div>

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Try</span>
          {EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              className={styles.chip}
              disabled={busy}
              onClick={() => run(question)}
            >
              {question}
            </button>
          ))}
        </div>

        <form className={styles.prompt} onSubmit={handleSubmit}>
          <label htmlFor="terminal-input" className="visually-hidden">
            Ask Koll a question
          </label>
          <span className={styles.promptGlyph} aria-hidden="true">
            ❯
          </span>
          <input
            id="terminal-input"
            ref={inputRef}
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="Fråga något, t.ex. Hur mycket la jag på mat i september?"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly={busy}
          />
          <button type="submit" className={styles.run} disabled={busy || !draft.trim()}>
            Run ↵
          </button>
        </form>
      </div>
    </Section>
  );
}
