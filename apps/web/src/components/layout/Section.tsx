import type { ReactNode } from "react";
import { Container } from "./Container";
import styles from "./Section.module.css";

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
};

/** One page section: a small label, a heading, an optional intro, then the content */
export function Section({ id, eyebrow, title, intro, children }: Props) {
  const titleId = `${id}-title`;

  return (
    <section id={id} className={styles.section} aria-labelledby={titleId}>
      <Container>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {intro && <p className={styles.intro}>{intro}</p>}
        </header>
        {children}
      </Container>
    </section>
  );
}
