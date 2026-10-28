import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CATEGORIES } from "@koll/shared";
import { monthlyTotals, recurringPayments, searchTransactions, spendingByCategory } from "./tools.js";

// IMPORTANT: this server talks to Claude Desktop over stdin/stdout.
// Anything printed with console.log would corrupt that conversation, so only use console.error.

const server = new McpServer({ name: "koll", version: "0.1.0" });

// Reused input fields. The descriptions are what the AI reads to fill them in correctly.
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const from = date.optional().describe("Start date, inclusive (YYYY-MM-DD)");
const to = date.optional().describe("End date, inclusive (YYYY-MM-DD)");

// Turns rows into the reply format MCP expects
const asText = (rows: unknown[]) => ({
  content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
});

// readOnlyHint tells the AI app these tools only look, never change anything
const readOnly = { readOnlyHint: true, openWorldHint: false };

server.registerTool(
  "spending_by_category",
  {
    title: "Spending by category",
    description: "Total spent per category in Swedish kronor, biggest first. Optionally limited to a period.",
    inputSchema: { from, to },
    annotations: readOnly,
  },
  async (args) => asText(await spendingByCategory(args)),
);

server.registerTool(
  "search_transactions",
  {
    title: "Search transactions",
    description:
      "Find individual transactions by merchant text, category and/or period, newest first. " +
      "Amounts are in kronor: negative = money out, positive = money in.",
    inputSchema: {
      text: z.string().optional().describe("Part of the merchant name or bank reference, e.g. 'spotify'"),
      category: z.enum(CATEGORIES).optional().describe("Only this category"),
      from,
      to,
      limit: z.number().int().min(1).max(100).optional().describe("Max rows, default 20"),
    },
    annotations: readOnly,
  },
  async (args) => asText(await searchTransactions(args)),
);

server.registerTool(
  "monthly_totals",
  {
    title: "Monthly totals",
    description: "Money in, money out and net per month, newest first.",
    inputSchema: {
      months: z.number().int().min(1).max(36).optional().describe("How many months back, default 6"),
    },
    annotations: readOnly,
  },
  async (args) => asText(await monthlyTotals(args)),
);

server.registerTool(
  "recurring_payments",
  {
    title: "Recurring payments",
    description:
      "Merchants that charged in at least 3 different months: likely subscriptions. " +
      "Shows how many months, the average and the highest amount, and the last charge.",
    annotations: readOnly,
  },
  async () => asText(await recurringPayments()),
);

await server.connect(new StdioServerTransport());
console.error("Koll MCP server running (stdio)");
