import { expect, test, type Page } from "@playwright/test";
import { askAndWait, monthPicker, openEmptyTerminal, terminalLog, tile } from "./helpers";

// Runs on a phone-sized screen (the "mobile" project in playwright.config.ts)

// The page must never be wider than the screen: that is what makes it scroll sideways
async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test("the month buttons use the short labels", async ({ page }) => {
  await page.goto("/");

  // innerText: only what the visitor can see (the long labels are in the page but hidden)
  await expect(monthPicker(page).getByRole("button")).toHaveText(["Aug", "Sep", "Oct*"], {
    useInnerText: true,
  });
  await expect(monthPicker(page).getByRole("button", { name: "Sep", pressed: true })).toBeVisible();
});

test("choosing a month works by touch", async ({ page }) => {
  await page.goto("/");

  await monthPicker(page).getByRole("button", { name: "Aug" }).tap();

  await expect(monthPicker(page).getByRole("button", { name: "Aug", pressed: true })).toBeVisible();
  await expect(tile(page, "Spent")).toContainText(/16\s740 kr/);
});

test("the page does not scroll sideways", async ({ page }) => {
  await page.goto("/");
  await expectNoSidewaysScroll(page);
});

test("the terminal works, and a table in an answer does not push the page wider", async ({ page }) => {
  await openEmptyTerminal(page);

  await askAndWait(page, "Hur mycket la jag på mat i september?");

  await expect(terminalLog(page)).toContainText("Du la totalt 5 600 kronor");
  await expect(terminalLog(page).getByRole("table")).toBeVisible();
  await expectNoSidewaysScroll(page);
});
