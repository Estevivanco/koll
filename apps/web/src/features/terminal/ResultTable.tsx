import type { CSSProperties } from "react";
import type { ResultRow } from "../../api";
import styles from "./ResultTable.module.css";

const swedishNumber = new Intl.NumberFormat("sv-SE");

/** The rows an agent returned. If there is a number column, each row also gets a small bar. */
export function ResultTable({ rows }: { rows: ResultRow[] }) {
  if (rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const numberColumn = columns.find((column) => typeof rows[0][column] === "number");
  const largest = numberColumn ? Math.max(...rows.map((row) => Math.abs(Number(row[numberColumn])))) : 0;
  const showBars = numberColumn !== undefined && rows.length > 1;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className={typeof rows[0][column] === "number" ? styles.number : undefined}
            >
              {column}
            </th>
          ))}
          {showBars && <th aria-hidden="true" />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => {
              const value = row[column];
              return typeof value === "number" ? (
                <td key={column} className={styles.number}>
                  {swedishNumber.format(value)}
                </td>
              ) : (
                <td key={column}>{value}</td>
              );
            })}
            {showBars && numberColumn && (
              <td aria-hidden="true" className={styles.barCell}>
                <span
                  className={styles.bar}
                  style={{ "--ratio": Math.abs(Number(row[numberColumn])) / largest } as CSSProperties}
                />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
