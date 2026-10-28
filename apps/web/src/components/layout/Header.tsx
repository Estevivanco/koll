import { Container } from "./Container";
import styles from "./Header.module.css";

const LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#terminal", label: "Terminal" },
  { href: "#how", label: "How it works" },
];

export function Header() {
  return (
    <header className={styles.header}>
      <Container>
        <div className={styles.inner}>
          <a className={styles.brand} href="#top" aria-label="Koll, back to top">
            <span className={styles.prompt} aria-hidden="true">
              ❯
            </span>
            koll
            <span className={styles.cursor} aria-hidden="true" />
          </a>

          <nav className={styles.nav} aria-label="Main">
            <ul className={styles.links}>
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a className={styles.link} href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <span className={styles.badge}>Demo data</span>
        </div>
      </Container>
    </header>
  );
}
