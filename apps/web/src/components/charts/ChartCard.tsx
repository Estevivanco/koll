import { useState, type ReactNode } from "react";
import styles from "./ChartCard.module.css";

type Props = {
  title: string;
  subtitle: string;
  chart: ReactNode;
  table: ReactNode;
};

/** Frame around every chart: title, and a switch between the chart and its table */
export function ChartCard({ title, subtitle, chart, table }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div className={styles.toggle} role="group" aria-label={`${title}: view`}>
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
            Chart
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            Table
          </button>
        </div>
      </header>
      <div className={view === "chart" ? styles.bodyChart : undefined}>
        {view === "chart" ? chart : table}
      </div>
    </article>
  );
}
