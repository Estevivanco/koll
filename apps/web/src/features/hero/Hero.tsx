import { Sparkline } from "../../components/charts/Sparkline";
import { Container } from "../../components/layout/Container";
import { LAST_FULL_MONTH, PREVIOUS_MONTH, TREND, totalSpent } from "../../data/demo";
import { formatKr } from "../../lib/format";
import styles from "./Hero.module.css";

export function Hero() {
  const spent = totalSpent(LAST_FULL_MONTH);
  const previous = totalSpent(PREVIOUS_MONTH);
  // The month in progress would look like a drop, so the hero chart leaves it out
  const finishedMonths = TREND.filter((m) => !m.partial);
  const change = Math.round(((spent - previous) / previous) * 100);

  return (
    <div className={styles.hero}>
      <Container>
        <div className={styles.grid}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>Personal finance · multi-agent</p>
            <h1 className={styles.title}>
              Ask your bank statement anything
              <span className={styles.cursor} aria-hidden="true" />
            </h1>
            <p className={styles.lead}>
              Koll reads a Swedbank export, sorts every purchase into a category, and answers questions in
              Swedish. Small AI agents do the work and talk to each other. Read-only SQL keeps the numbers
              honest.
            </p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#terminal">
                Open the terminal
              </a>
              <a className={styles.secondary} href="#how">
                How it works
              </a>
            </div>
          </div>

          <aside className={styles.figure} aria-label="Spending in the last full month">
            <p className={styles.figureLabel}>Spent in {LAST_FULL_MONTH.label.replace(" 2026", "")}</p>
            <p className={styles.figureValue}>{formatKr(spent)}</p>
            <p className={styles.figureDelta}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs {PREVIOUS_MONTH.short}
            </p>
            <div className={styles.spark}>
              <Sparkline
                label={`Spending per month: ${finishedMonths.map((m) => `${m.short} ${formatKr(m.spent)}`).join(", ")}`}
                points={finishedMonths.map((m) => ({
                  label: m.short,
                  value: m.spent,
                  highlight: m.id === LAST_FULL_MONTH.id,
                }))}
              />
            </div>
            <p className={styles.figureNote}>Made-up demo data</p>
          </aside>
        </div>
      </Container>
    </div>
  );
}
