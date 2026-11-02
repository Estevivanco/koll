/*
  Demo data. Every number here is made up.
  The real transactions stay on the owner's machine and are never shown on the website.
*/

export type CategorySpend = {
  category: string;
  spent: number;
  /** How many transactions it is made of */
  count: number;
};

export type MonthId = "2026-08" | "2026-09" | "2026-10";

export type MonthDetail = {
  id: MonthId;
  label: string;
  short: string;
  /** The month is not over yet */
  partial: boolean;
  income: number;
  transactions: number;
  /** Share of transactions sorted by the owner's rules (the rest went to the AI), 0 to 1 */
  byRules: number;
  categories: CategorySpend[];
};

/** One bar in the monthly chart. Only the last three months have a category breakdown. */
export type MonthTotal = {
  id: string;
  short: string;
  spent: number;
  partial: boolean;
  detail: MonthDetail | undefined;
};

export function totalSpent(month: MonthDetail): number {
  return month.categories.reduce((sum, c) => sum + c.spent, 0);
}

export const MONTHS: MonthDetail[] = [
  {
    id: "2026-08",
    label: "August 2026",
    short: "Aug",
    partial: false,
    income: 24500,
    transactions: 52,
    byRules: 0.28,
    categories: [
      { category: "Boende", spent: 7500, count: 1 },
      { category: "Mat", spent: 3050, count: 17 },
      { category: "Restaurang", spent: 1820, count: 9 },
      { category: "Transport", spent: 1190, count: 8 },
      { category: "Prenumeration", spent: 870, count: 4 },
      { category: "Shopping", spent: 640, count: 3 },
      { category: "Nöje", spent: 610, count: 4 },
      { category: "Hälsa", spent: 330, count: 2 },
      { category: "Tobak", spent: 480, count: 3 },
      { category: "Övrigt", spent: 250, count: 1 },
    ],
  },
  {
    id: "2026-09",
    label: "September 2026",
    short: "Sep",
    partial: false,
    income: 24500,
    transactions: 61,
    byRules: 0.31,
    categories: [
      { category: "Boende", spent: 7500, count: 1 },
      { category: "Mat", spent: 3420, count: 19 },
      { category: "Restaurang", spent: 2180, count: 11 },
      { category: "Transport", spent: 1360, count: 9 },
      { category: "Prenumeration", spent: 870, count: 4 },
      { category: "Shopping", spent: 960, count: 4 },
      { category: "Nöje", spent: 740, count: 5 },
      { category: "Hälsa", spent: 410, count: 2 },
      { category: "Tobak", spent: 520, count: 4 },
      { category: "Övrigt", spent: 350, count: 2 },
    ],
  },
  {
    id: "2026-10",
    label: "October 2026 (so far)",
    short: "Oct",
    partial: true,
    income: 24500,
    transactions: 34,
    byRules: 0.35,
    categories: [
      { category: "Boende", spent: 7500, count: 1 },
      { category: "Mat", spent: 1960, count: 11 },
      { category: "Restaurang", spent: 780, count: 5 },
      { category: "Transport", spent: 410, count: 4 },
      { category: "Prenumeration", spent: 290, count: 2 },
      { category: "Shopping", spent: 230, count: 1 },
      { category: "Nöje", spent: 190, count: 2 },
      { category: "Tobak", spent: 150, count: 3 },
      { category: "Övrigt", spent: 50, count: 1 },
    ],
  },
];

const EARLIER: Pick<MonthTotal, "id" | "short" | "spent">[] = [
  { id: "2026-05", short: "May", spent: 17420 },
  { id: "2026-06", short: "Jun", spent: 15980 },
  { id: "2026-07", short: "Jul", spent: 19260 },
];

/** Six months of total spending, for the trend chart */
export const TREND: MonthTotal[] = [
  ...EARLIER.map((m) => ({ ...m, partial: false, detail: undefined })),
  ...MONTHS.map((m) => ({
    id: m.id,
    short: m.short,
    spent: totalSpent(m),
    partial: m.partial,
    detail: m,
  })),
];

/** The last finished month, shown in the hero */
export const LAST_FULL_MONTH = MONTHS[1];
export const PREVIOUS_MONTH = MONTHS[0];
