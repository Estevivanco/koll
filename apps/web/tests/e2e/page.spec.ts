import { expect, test } from "@playwright/test";

test.describe("the page", () => {
  test("loads with its main parts and without errors", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => problems.push(`failed: ${request.url()}`));
    page.on("response", (response) => {
      if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Ask your bank statement anything/);
    // Scroll through the whole page, so everything that loads lazily has loaded
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.waitForLoadState("networkidle");

    expect(problems).toEqual([]);
  });

  test("has the right title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/koll/i);
  });

  test("says everywhere that the data is made up", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Demo data", { exact: true })).toBeVisible(); // header badge
    await expect(page.getByText("Made-up demo data")).toBeVisible(); // hero card
    await expect(page.locator("footer")).toContainText("Every number on this page is made up");
  });

  test("shows last month's spending in the hero", async ({ page }) => {
    await page.goto("/");

    const hero = page.getByRole("complementary", { name: "Spending in the last full month" });
    await expect(hero).toContainText("Spent in September");
    await expect(hero).toContainText(/18\s310 kr/);
    await expect(hero).toContainText("▲ 9% vs Aug");
  });

  test("has a footer link to the source code", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Source on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/Estevivanco/koll",
    );
  });
});

test.describe("navigation", () => {
  test("the main menu has the three sections", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Main" });

    await expect(menu.getByRole("link")).toHaveText(["Overview", "Terminal", "How it works"]);
  });

  for (const [link, section] of [
    ["Overview", "#overview"],
    ["Terminal", "#terminal"],
    ["How it works", "#how"],
  ] as const) {
    test(`"${link}" scrolls to its section`, async ({ page }) => {
      await page.goto("/");

      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: link }).click();

      await expect(page).toHaveURL(new RegExp(`${section}$`));
      await expect(page.locator(section)).toBeInViewport();
    });
  }

  test('the hero button "Open the terminal" scrolls to the terminal', async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Open the terminal" }).click();

    await expect(page).toHaveURL(/#terminal$/);
    await expect(
      page.getByRole("heading", { name: "Ask in Swedish, watch the agents work" }),
    ).toBeInViewport();
  });

  test("the logo goes back to the top", async ({ page }) => {
    await page.goto("/#how");

    await page.getByRole("link", { name: "Koll, back to top" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  });
});
