import { useState } from "react";
import { DataTable } from "../../components/DataTable";
import { StatTile } from "../../components/StatTile";
import { ChartCard } from "../../components/charts/ChartCard";
import { Section } from "../../components/layout/Section";
import { LAST_FULL_MONTH, MONTHS, TREND, totalSpent, type MonthId } from "../../data/demo";
import { formatKr, formatPercent } from "../../lib/format";
import { MonthPicker } from "./MonthPicker";
import { MonthlyTrend } from "./MonthlyTrend";
import { SpendingByCategory } from "./SpendingByCategory";
import styles from "./Overview.module.css";

export function Overview() {
  const [monthId, setMonthId] = useState<MonthId>(LAST_FULL_MONTH.id);
  const month = MONTHS.find((m) => m.id === monthId) ?? LAST_FULL_MONTH;

  const spent = totalSpent(month);
  const biggest = [...month.categories].sort((a, b) => b.spent - a.spent)[0];
  const byCategory = [...month.categories].sort((a, b) => b.spent - a.spent);

  return (
    <Section
      id="overview"
      eyebrow="Overview"
      title="Where the money went"
      intro="A month at a glance. The terminal below answers questions about exactly this data."
    >
      {/* One filter row above everything it controls */}
      <div className={styles.filters}>
        <MonthPicker months={MONTHS} selected={monthId} onSelect={setMonthId} />
      </div>

      <div className={styles.tiles}>
        <StatTile
          label="Spent"
          value={formatKr(spent)}
          detail={month.partial ? "so far this month" : "in the month"}
        />
        <StatTile label="Income" value={formatKr(month.income)} detail="salary" />
        <StatTile
          label="Left over"
          value={formatKr(month.income - spent)}
          detail={`${formatPercent(month.income - spent, month.income)} of income`}
        />
        <StatTile
          label="Biggest category"
          value={biggest.category}
          detail={`${formatKr(biggest.spent)} · ${formatPercent(biggest.spent, spent)} of spending`}
        />
        <StatTile label="Transactions" value={String(month.transactions)} detail="imported from the bank" />
        <StatTile
          label="Sorted by your rules"
          value={formatPercent(month.byRules, 1)}
          detail="the rest went to the AI"
        />
      </div>

      <div className={styles.charts}>
        <ChartCard
          title="Spending by category"
          subtitle={`${month.label} · ${byCategory.length} categories`}
          chart={<SpendingByCategory categories={month.categories} />}
          table={
            <DataTable
              caption={`Spending by category, ${month.label}`}
              columns={[
                { key: "category", label: "Category" },
                { key: "spent", label: "Spent", numeric: true },
                { key: "share", label: "Share", numeric: true },
                { key: "count", label: "Transactions", numeric: true },
              ]}
              rows={byCategory.map((c) => ({
                category: c.category,
                spent: formatKr(c.spent),
                share: formatPercent(c.spent, spent),
                count: c.count,
              }))}
            />
          }
        />

        <ChartCard
          title="Spending per month"
          subtitle="Last six months · click a month to select it"
          chart={<MonthlyTrend months={TREND} selected={monthId} onSelect={setMonthId} />}
          table={
            <DataTable
              caption="Total spending per month"
              columns={[
                { key: "month", label: "Month" },
                { key: "spent", label: "Spent", numeric: true },
              ]}
              rows={TREND.map((m) => ({
                month: m.partial ? `${m.short} (so far)` : m.short,
                spent: formatKr(m.spent),
              }))}
            />
          }
        />
      </div>
      <p className={styles.footnote}>* The month is not over yet.</p>
    </Section>
  );
}
