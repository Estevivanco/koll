import { Container } from "./Container";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.inner}>
          <p className={styles.note}>
            Every number on this page is made up. The real project runs on the owner&apos;s own bank export
            and never shows it here.
          </p>
          <p className={styles.stack}>
            TypeScript · React · A2A · MCP · Postgres · Gemini on Vertex AI · Docker · Kubernetes
          </p>
          <a className={styles.link} href="https://github.com/Estevivanco/koll">
            Source on GitHub
          </a>
        </div>
      </Container>
    </footer>
  );
}
