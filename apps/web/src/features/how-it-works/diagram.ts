/*
  The data behind the architecture diagram: boxes, arrows and what each part does.
  Coordinates are in the SVG's own units (the diagram is 1000 wide and 440 tall).
*/

export type NodeKind = "client" | "agent" | "store";

export type DiagramNode = {
  id: string;
  title: string;
  subtitle: string;
  kind: NodeKind;
  /** Calls Gemini, so each use counts against the daily limit */
  usesGemini: boolean;
  /** Shown under the diagram when the node is selected */
  blurb: string;
  x: number;
  y: number;
};

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 88;

export const NODES: DiagramNode[] = [
  {
    id: "you",
    title: "You",
    subtitle: "Terminal or website",
    kind: "client",
    usesGemini: false,
    blurb: "You ask a question in plain Swedish. That is the only input.",
    x: 20,
    y: 122,
  },
  {
    id: "orchestrator",
    title: "Orchestrator",
    subtitle: "Picks the right agent",
    kind: "agent",
    usesGemini: true,
    blurb:
      "Fetches each agent's card (its name and skills), then asks Gemini which agent fits the question. If none fits, it says so instead of guessing.",
    x: 250,
    y: 122,
  },
  {
    id: "categorizer",
    title: "Categorizer",
    subtitle: "Rules first, then AI",
    kind: "agent",
    usesGemini: true,
    blurb:
      "Gives each transaction a category. The owner's own rules run first and always win; only what is left goes to Gemini, in one batch.",
    x: 520,
    y: 20,
  },
  {
    id: "analyst",
    title: "Analyst",
    subtitle: "Question to SQL to answer",
    kind: "agent",
    usesGemini: true,
    blurb:
      "Gemini writes one SELECT query, Postgres runs it with a read-only login, and Gemini explains the numbers in a sentence.",
    x: 520,
    y: 224,
  },
  {
    id: "postgres",
    title: "Postgres",
    subtitle: "Transactions",
    kind: "store",
    usesGemini: false,
    blurb:
      "Holds every imported transaction. The analyst and the MCP server get a login that can only read it.",
    x: 790,
    y: 122,
  },
  {
    id: "claude",
    title: "Claude Desktop",
    subtitle: "Any MCP client",
    kind: "client",
    usesGemini: false,
    blurb:
      "A second way in: an AI app that speaks MCP can use the same data without going through the orchestrator.",
    x: 20,
    y: 330,
  },
  {
    id: "mcp",
    title: "MCP server",
    subtitle: "Four read-only tools",
    kind: "agent",
    usesGemini: false,
    blurb:
      "Exposes fixed, ready-made queries as tools (spending by category, search, monthly totals, recurring payments). No model writes SQL on this path.",
    x: 250,
    y: 330,
  },
];

export type DiagramEdge = {
  /** SVG path between two boxes */
  path: string;
  label?: { text: string; x: number; y: number };
};

// Each path starts at the right edge of one box and ends at the left (or bottom) edge of the next
export const EDGES: DiagramEdge[] = [
  { path: "M210 166 L248 166", label: { text: "ask", x: 229, y: 152 } },
  { path: "M440 166 C 480 166, 480 64, 518 64", label: { text: "A2A", x: 454, y: 104 } },
  { path: "M440 166 C 480 166, 480 268, 518 268" },
  { path: "M710 64 C 750 64, 750 166, 788 166" },
  { path: "M710 268 C 750 268, 750 166, 788 166", label: { text: "read-only", x: 806, y: 238 } },
  { path: "M210 374 L248 374", label: { text: "MCP", x: 229, y: 360 } },
  { path: "M440 374 C 700 374, 885 330, 885 212", label: { text: "read-only", x: 560, y: 396 } },
];
