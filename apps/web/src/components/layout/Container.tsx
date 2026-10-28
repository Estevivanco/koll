import type { ReactNode } from "react";
import styles from "./Container.module.css";

/** Keeps content in a centered column with the same side padding everywhere */
export function Container({ children }: { children: ReactNode }) {
  return <div className={styles.container}>{children}</div>;
}
