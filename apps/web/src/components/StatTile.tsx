import styles from "./StatTile.module.css";

type Props = {
  label: string;
  value: string;
  detail?: string;
};

/** One headline number with a label and an optional line of context */
export function StatTile({ label, value, detail }: Props) {
  return (
    <div className={styles.tile}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  );
}
