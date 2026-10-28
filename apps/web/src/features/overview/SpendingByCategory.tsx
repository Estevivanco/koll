import type { CSSProperties } from "react";
import type { CategorySpend } from "../../data/demo";
import { formatKr, formatPercent } from "../../lib/format";
import styles from "./SpendingByCategory.module.css";

type Props = {
  categories: CategorySpend[];
};

/** Horizontal bars, biggest first. One color: the names already say which is which. */
export function SpendingByCategory({ categories }: Props) {
  const sorted = [...categories].sort((a, b) => b.spent - a.spent);
  const total = sorted.reduce((sum, c) => sum + c.spent, 0);
  const max = sorted[0]?.spent ?? 1;

  return (
    <ul className={styles.list}>
      {sorted.map((c) => (
        <li key={c.category} className={styles.row} tabIndex={0}>
          <span className={styles.label}>{c.category}</span>
          <span className={styles.track}>
            <span className={styles.bar} style={{ "--ratio": c.spent / max } as CSSProperties} />
            <span className={styles.value}>{formatKr(c.spent)}</span>
          </span>
          <span className={styles.tip} role="tooltip">
            <strong>{c.category}</strong> {formatKr(c.spent)} · {formatPercent(c.spent, total)} of spending ·{" "}
            {c.count} {c.count === 1 ? "transaction" : "transactions"}
          </span>
        </li>
      ))}
    </ul>
  );
}
