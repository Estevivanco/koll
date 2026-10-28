import { Section } from "../../components/layout/Section";
import { AgentDiagram } from "./AgentDiagram";
import styles from "./HowItWorks.module.css";

const STEPS = [
  "You ask a question in Swedish.",
  "The orchestrator reads each agent's card (name and skills) and asks Gemini which agent fits. If none does, it says so.",
  "The analyst has Gemini write one SELECT query, runs it read-only in Postgres, and has Gemini explain the numbers. Or the categorizer applies your own rules first and sends only the rest to Gemini.",
  "Every Gemini call is counted. After the daily limit, the agents stop.",
];

const SAFEGUARDS = [
  {
    title: "Rules before AI",
    text: "Your own rules, like a fixed merchant always being the same category, win over the model. They are free and predictable.",
  },
  {
    title: "Read-only by design",
    text: "The analyst's database login can only read one table. A bad query cannot change or leak anything else.",
  },
  {
    title: "Capped spending",
    text: "One shared counter stops all agents at a daily limit, and refuses to run if it cannot check the count.",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="Under the hood"
      title="Small agents, one question"
      intro="Each agent does one job and announces it on an agent card. The orchestrator finds them at runtime and sends each question to the right one over the A2A protocol."
    >
      <div className={styles.diagram}>
        <AgentDiagram />
      </div>

      <ol className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className={styles.safeguards}>
        {SAFEGUARDS.map((item) => (
          <article key={item.title} className={styles.safeguard}>
            <h3 className={styles.safeguardTitle}>{item.title}</h3>
            <p className={styles.safeguardText}>{item.text}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
