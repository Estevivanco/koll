import { useState, type KeyboardEvent } from "react";
import { EDGES, NODES, NODE_HEIGHT, NODE_WIDTH, type DiagramNode } from "./diagram";
import styles from "./AgentDiagram.module.css";

/** The system as boxes and arrows. Click or tab to a box to read what it does. */
export function AgentDiagram() {
  const [selectedId, setSelectedId] = useState("orchestrator");
  const selected = NODES.find((node) => node.id === selectedId) ?? NODES[0];

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, node: DiagramNode) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId(node.id);
    }
  }

  return (
    <div className={styles.diagram}>
      <svg viewBox="0 0 1000 440" role="group" aria-label="How the parts of Koll connect">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L10 5 L0 10 z" className={styles.arrowHead} />
          </marker>
        </defs>

        {EDGES.map((edge) => (
          <g key={edge.path}>
            <path d={edge.path} className={styles.edge} markerEnd="url(#arrow)" />
            {edge.label && (
              <text x={edge.label.x} y={edge.label.y} textAnchor="middle" className={styles.edgeLabel}>
                {edge.label.text}
              </text>
            )}
          </g>
        ))}

        {NODES.map((node) => (
          <g
            key={node.id}
            className={`${styles.node} ${styles[node.kind]} ${node.id === selectedId ? styles.selected : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={node.id === selectedId}
            aria-label={`${node.title}: ${node.subtitle}`}
            onClick={() => setSelectedId(node.id)}
            onMouseEnter={() => setSelectedId(node.id)}
            onFocus={() => setSelectedId(node.id)}
            onKeyDown={(event) => handleKeyDown(event, node)}
          >
            <rect x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT} rx={12} />
            <text x={node.x + 18} y={node.y + 32} className={styles.nodeTitle}>
              {node.title}
            </text>
            <text x={node.x + 18} y={node.y + 54} className={styles.nodeSubtitle}>
              {node.subtitle}
            </text>
            {node.usesGemini && (
              <>
                <circle cx={node.x + 22} cy={node.y + 72} r={4} className={styles.geminiDot} />
                <text x={node.x + 32} y={node.y + 76} className={styles.geminiLabel}>
                  Gemini
                </text>
              </>
            )}
          </g>
        ))}
      </svg>

      <ul className={styles.legend} aria-label="Legend">
        <li>
          <span className={`${styles.swatch} ${styles.swatchAgent}`} /> Agent or server
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchStore}`} /> Data
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchClient}`} /> Client
        </li>
        <li>
          <span className={styles.dot} /> Calls Gemini (counted against a daily limit)
        </li>
      </ul>

      <div className={styles.readout} aria-live="polite">
        <p className={styles.readoutTitle}>{selected.title}</p>
        <p className={styles.readoutText}>{selected.blurb}</p>
      </div>
    </div>
  );
}
