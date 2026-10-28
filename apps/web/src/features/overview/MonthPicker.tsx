import type { MonthDetail, MonthId } from "../../data/demo";
import styles from "./MonthPicker.module.css";

type Props = {
  months: MonthDetail[];
  selected: MonthId;
  onSelect: (id: MonthId) => void;
};

/** Chooses which month everything below it shows */
export function MonthPicker({ months, selected, onSelect }: Props) {
  return (
    <div className={styles.picker} role="group" aria-label="Month">
      {months.map((month) => (
        <button
          key={month.id}
          type="button"
          className={styles.option}
          aria-pressed={month.id === selected}
          onClick={() => onSelect(month.id)}
        >
          <span className={styles.long}>{month.label}</span>
          <span className={styles.short}>
            {month.short}
            {month.partial && "*"}
          </span>
        </button>
      ))}
    </div>
  );
}
