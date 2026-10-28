const swedishNumber = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

/** 18310 -> "18 310 kr" */
export function formatKr(amount: number): string {
  return `${swedishNumber.format(amount)} kr`;
}

/** Short numbers for axis ticks: 0, 500, 5K, 12.5K */
export function formatCompact(amount: number): string {
  if (amount < 1000) return String(amount);
  const thousands = amount / 1000;
  return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
}

/** formatPercent(3, 12) -> "25%" */
export function formatPercent(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
