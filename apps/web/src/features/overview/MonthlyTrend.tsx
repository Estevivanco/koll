import type { CSSProperties } from "react";
import type { MonthId, MonthTotal } from "../../data/demo";
import { formatCompact, formatKr } from "../../lib/format";
import styles from "./MonthlyTrend.module.css";

type Props = {
  months: MonthTotal[];
  selected: MonthId;
  onSelect: (id: MonthId) => void;
};

const TICK_STEP = 5000;

/**
 * One column per month. The selected month is green, the rest are gray: the chart answers
 * "how does this month compare?", not "which month is which color?".
 */
export function MonthlyTrend({ months, selected, onSelect }: Props) {
  const top = Math.ceil(Math.max(...months.map((m) => m.spent)) / TICK_STEP) * TICK_STEP;
  const ticks = Array.from({ length: top / TICK_STEP + 1 }, (_, i) => i * TICK_STEP);

  return (
    <div className={styles.chart}>
      <div className={styles.yAxis} aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className={styles.tick} style={{ "--at": tick / top } as CSSProperties}>
            {formatCompact(tick)}
          </span>
        ))}
      </div>

      <div className={styles.plot}>
        {ticks.map((tick) => (
          <span
            key={tick}
            className={tick === 0 ? styles.baseline : styles.grid}
            style={{ "--at": tick / top } as CSSProperties}
            aria-hidden="true"
          />
        ))}

        <div className={styles.columns}>
          {months.map((month, index) => {
            const isSelected = month.id === selected;
            const hasDetail = month.detail !== undefined;
            const edge = index === 0 ? styles.tipStart : index === months.length - 1 ? styles.tipEnd : "";

            return (
              <button
                key={month.id}
                type="button"
                className={styles.slot}
                aria-pressed={isSelected}
                aria-disabled={!hasDetail}
                onClick={() => month.detail && onSelect(month.detail.id)}
                style={{ "--ratio": month.spent / top } as CSSProperties}
              >
                <span className={isSelected ? styles.barSelected : styles.bar} />
                {isSelected && <span className={styles.value}>{formatKr(month.spent)}</span>}
                <span className={`${styles.tip} ${edge}`} role="tooltip">
                  <strong>{month.short}</strong> {formatKr(month.spent)}
                  {month.partial && " so far"}
                  {!hasDetail && " · no category detail in the demo"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.xAxis}>
        {months.map((month) => (
          <span key={month.id} className={month.id === selected ? styles.xLabelSelected : styles.xLabel}>
            {month.short}
            {month.partial && "*"}
          </span>
        ))}
      </div>
    </div>
  );
}
