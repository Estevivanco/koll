import styles from "./Sparkline.module.css";

type Props = {
  /** Read out by screen readers, since the bars themselves are only a picture */
  label: string;
  points: { label: string; value: number; highlight?: boolean }[];
};

/** A tiny column chart with no axes: only the shape of the last few months */
export function Sparkline({ label, points }: Props) {
  const max = Math.max(...points.map((p) => p.value));

  return (
    <div className={styles.sparkline} role="img" aria-label={label}>
      {points.map((point) => (
        <div key={point.label} className={styles.cell}>
          <div className={styles.plot}>
            <div
              className={point.highlight ? styles.barHighlight : styles.bar}
              style={{ height: `${(point.value / max) * 100}%` }}
            />
          </div>
          <span className={styles.label}>{point.label}</span>
        </div>
      ))}
    </div>
  );
}
