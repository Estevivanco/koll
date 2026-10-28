import type { AskEvent } from "../../api";
import { ResultTable } from "./ResultTable";
import type { Entry } from "./useTerminal";
import styles from "./TerminalEntry.module.css";

function EventLine({ event }: { event: AskEvent }) {
  switch (event.type) {
    case "agents":
      return (
        <p className={styles.line}>
          <span className={styles.dim}>agents </span>
          {event.names.join(" · ")}
        </p>
      );
    case "route":
      return event.agent === "none" ? (
        <>
          <p className={styles.notice}>✗ no agent can handle that</p>
          <p className={styles.why}>{event.reason}</p>
        </>
      ) : (
        <>
          <p className={styles.agent}>→ {event.agent}</p>
          <p className={styles.why}>why: {event.reason}</p>
        </>
      );
    case "sql":
      return (
        <>
          <p className={styles.dim}>sql</p>
          <pre className={styles.sql}>{event.sql}</pre>
        </>
      );
    case "rows":
      return <ResultTable rows={event.rows} />;
    case "answer":
      return (
        <p className={styles.answer}>
          <span className={styles.check} aria-hidden="true">
            ✓{" "}
          </span>
          {event.text}
        </p>
      );
    case "notice":
      return <p className={styles.notice}>{event.text}</p>;
    case "error":
      return <p className={styles.notice}>! {event.text}</p>;
  }
}

/** One question and everything that happened while it was answered */
export function TerminalEntry({ entry }: { entry: Entry }) {
  return (
    <div className={styles.entry}>
      <p className={styles.question}>
        <span className={styles.prompt} aria-hidden="true">
          ❯{" "}
        </span>
        {entry.question}
      </p>
      {entry.events.map((event, index) => (
        <EventLine key={index} event={event} />
      ))}
      {entry.running && <span className={styles.cursor} aria-label="Working" />}
    </div>
  );
}
