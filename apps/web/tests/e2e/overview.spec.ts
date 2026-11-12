import { expect, test } from "@playwright/test";
import { MONTHS, totalSpent } from "../../src/data/demo";
import { formatPercent } from "../../src/lib/format";
import { kr, monthPicker, tile } from "./helpers";

// The tiles must show the numbers in src/data/demo.ts, for whichever month is selected.
// (One number is also written out by hand below, so a mistake in the data itself would show up too.)

test.describe("the month picker", () => {
  test("starts on September, the last finished month", async ({ page }) => {
    await page.goto("/");

    const picker = monthPicker(page);
    await expect(picker.getByRole("button", { name: "September 2026", pressed: true })).toBeVisible();
    await expect(picker.getByRole("button", { pressed: true })).toHaveCount(1);
  });

  test("September shows 18 310 kr spent", async ({ page }) => {
    await page.goto("/");

    await expect(tile(page, "Spent")).toContainText(/18\s310 kr/);
    await expect(tile(page, "Spent")).toContainText("in the month");
    await expect(tile(page, "Biggest category")).toContainText("Boende");
  });

  for (const month of MONTHS) {
    test(`${month.label} shows its own numbers`, async ({ page }) => {
      await page.goto("/");
      const spent = totalSpent(month);
      const biggest = [...month.categories].sort((a, b) => b.spent - a.spent)[0];

      await monthPicker(page).getByRole("button", { name: month.label }).click();

      await expect(page.getByRole("button", { name: month.label, pressed: true })).toBeVisible();
      await expect(tile(page, "Spent")).toContainText(kr(spent));
      await expect(tile(page, "Spent")).toContainText(month.partial ? "so far this month" : "in the month");
      await expect(tile(page, "Income")).toContainText(kr(month.income));
      await expect(tile(page, "Left over")).toContainText(kr(month.income - spent));
      await expect(tile(page, "Biggest category")).toContainText(biggest.category);
      await expect(tile(page, "Transactions")).toHaveText(
        new RegExp(`${month.transactions}\\s*imported from the bank`),
      );
      await expect(tile(page, "Sorted by your rules")).toContainText(formatPercent(month.byRules, 1));
    });
  }

  test("only one month is selected at a time", async ({ page }) => {
    await page.goto("/");
    const picker = monthPicker(page);

    await picker.getByRole("button", { name: "August 2026" }).click();

    await expect(picker.getByRole("button", { pressed: true })).toHaveCount(1);
    await expect(picker.getByRole("button", { name: "September 2026" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

test.describe("the charts", () => {
  test("show the same numbers as a table", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("group", { name: "Spending by category: view" })
      .getByRole("button", { name: "Table" })
      .click();

    const table = page.getByRole("table", { name: "Spending by category, September 2026" });
    const rows = table.getByRole("row");
    await expect(rows.nth(1)).toContainText("Boende"); // biggest first
    await expect(rows.nth(1)).toContainText(/7\s500 kr/);
    await expect(rows).toHaveCount(1 + 10); // header + ten categories
  });

  test("the category table follows the selected month", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("group", { name: "Spending by category: view" })
      .getByRole("button", { name: "Table" })
      .click();

    await monthPicker(page).getByRole("button", { name: "October 2026" }).click();

    // October has no Hälsa, so one row less than September
    const table = page.getByRole("table", { name: "Spending by category, October 2026 (so far)" });
    await expect(table.getByRole("row")).toHaveCount(1 + 9);
  });

  test("the monthly trend table lists six months and marks the unfinished one", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("group", { name: "Spending per month: view" })
      .getByRole("button", { name: "Table" })
      .click();

    const rows = page.getByRole("table", { name: "Total spending per month" }).getByRole("row");
    await expect(rows).toHaveCount(1 + 6);
    await expect(rows.nth(6)).toContainText("Oct (so far)");
  });

  test("switch back from the table to the chart", async ({ page }) => {
    await page.goto("/");
    const view = page.getByRole("group", { name: "Spending by category: view" });
    await view.getByRole("button", { name: "Table" }).click();

    await view.getByRole("button", { name: "Chart" }).click();

    await expect(view.getByRole("button", { name: "Chart", pressed: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Spending by category, September 2026" })).toHaveCount(0);
  });
});
