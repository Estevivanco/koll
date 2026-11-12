import { expect, test } from "@playwright/test";
import { ask, askAndWait, openEmptyTerminal, terminalInput, terminalLog } from "./helpers";

// Demo mode: scripted answers (src/api/mockAsk.ts) on made-up data. No backend and no Gemini.

// Written out here (not imported), so changing an example on the website makes this test say so
const FOOD = "Hur mycket la jag på mat i september?";
const SHOPS = "Vilka tre butiker handlar jag mest hos?";
const CATEGORIZE = "Kategorisera 20 transaktioner";
const WEATHER = "Vad blir vädret imorgon?";

const runButton = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /^Run/ });
const chip = (page: import("@playwright/test").Page, question: string) =>
  page.getByRole("button", { name: question, exact: true });

test.describe("autoplay", () => {
  test("runs the first example by itself when the terminal scrolls into view", async ({ page }) => {
    await page.goto("/");
    await expect(terminalLog(page)).not.toContainText(FOOD); // nothing yet: it is far down the page

    await terminalLog(page).scrollIntoViewIfNeeded();

    const log = terminalLog(page);
    await expect(log).toContainText(FOOD);
    await expect(log).toContainText("→ Koll Analyst");
    await expect(log).toContainText("Du la totalt 5 600 kronor på mat i september");
  });

  test("runs only once, even if the visitor scrolls away and back", async ({ page }) => {
    await page.goto("/");
    await terminalLog(page).scrollIntoViewIfNeeded();
    await expect(terminalLog(page)).toContainText("Du la totalt 5 600 kronor");

    await page.getByRole("link", { name: "Koll, back to top" }).click();
    await terminalLog(page).scrollIntoViewIfNeeded();

    await expect(terminalLog(page).getByText("Du la totalt 5 600 kronor")).toHaveCount(1);
  });
});

test.describe("the example buttons", () => {
  test("are the four examples, in order", async ({ page }) => {
    await openEmptyTerminal(page);

    const buttons = page.locator("#terminal button").filter({ hasNotText: /^Run/ });
    await expect(buttons).toHaveText([FOOD, SHOPS, CATEGORIZE, WEATHER]);
  });

  test("a spending question goes to the Analyst: SQL, rows and an answer", async ({ page }) => {
    await openEmptyTerminal(page);

    await chip(page, FOOD).click();

    const log = terminalLog(page);
    await expect(log).toContainText("agents Koll Categorizer · Koll Analyst");
    await expect(log).toContainText("→ Koll Analyst");
    await expect(log).toContainText("category IN ('Mat', 'Restaurang')");
    const table = log.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(1 + 2);
    await expect(table).toContainText("Mat");
    await expect(table).toContainText(/3\s420/);
    await expect(table).toContainText("Restaurang");
    await expect(table).toContainText(/2\s180/);
    await expect(log).toContainText("Du la totalt 5 600 kronor på mat i september, varav 3 420 kr i butik");
  });

  test("a question about shops lists the top three", async ({ page }) => {
    await openEmptyTerminal(page);

    await chip(page, SHOPS).click();

    const rows = terminalLog(page).getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(1 + 3);
    await expect(rows.nth(1)).toContainText("ICA MAXI");
    await expect(rows.nth(1)).toContainText(/3\s180/);
    await expect(terminalLog(page)).toContainText("De tre butikerna du handlar mest hos är ICA MAXI");
  });

  test("a categorize request goes to the Categorizer, with rows but no SQL", async ({ page }) => {
    await openEmptyTerminal(page);

    await chip(page, CATEGORIZE).click();

    const log = terminalLog(page);
    await expect(log).toContainText("→ Koll Categorizer");
    await expect(log).toContainText("Categorized 20: 6 by rules, 14 by AI.");
    await expect(log.getByRole("table")).toContainText("SPOTIFY");
    await expect(log.locator("pre")).toHaveCount(0); // no SQL block
  });

  test("a question no agent can answer says so", async ({ page }) => {
    await openEmptyTerminal(page);

    await chip(page, WEATHER).click();

    const log = terminalLog(page);
    await expect(log).toContainText("✗ no agent can handle that");
    await expect(log).toContainText("ingen agent kan hjälpa till");
    await expect(log.getByRole("table")).toHaveCount(0);
  });

  test("can be used again after an answer", async ({ page }) => {
    await openEmptyTerminal(page);

    await chip(page, FOOD).click();
    await expect(terminalLog(page)).toContainText("Du la totalt 5 600 kronor");
    await chip(page, SHOPS).click();

    await expect(terminalLog(page)).toContainText("De tre butikerna");
    await expect(terminalLog(page).getByText("Du la totalt 5 600 kronor")).toHaveCount(1); // earlier answer is kept
  });
});

test.describe("typing a question", () => {
  test("runs on Enter, shows the question and the answer, and empties the input", async ({ page }) => {
    await openEmptyTerminal(page);

    await ask(page, "Hur mycket spenderade jag i oktober?");

    const log = terminalLog(page);
    await expect(log).toContainText("Hur mycket spenderade jag i oktober?");
    await expect(log).toContainText("Du spenderade totalt 11 560 kronor i oktober hittills.");
    await expect(terminalInput(page)).toHaveValue("");
  });

  test("runs with the Run button too", async ({ page }) => {
    await openEmptyTerminal(page);

    await terminalInput(page).fill("Kategorisera mina köp");
    await runButton(page).click();

    await expect(terminalLog(page)).toContainText("Categorized 20");
  });

  test("the Run button is disabled until there is something to ask", async ({ page }) => {
    await openEmptyTerminal(page);

    await expect(runButton(page)).toBeDisabled();
    await terminalInput(page).fill("   ");
    await expect(runButton(page)).toBeDisabled();
    await terminalInput(page).fill("hej");
    await expect(runButton(page)).toBeEnabled();
  });

  test("pressing Enter on an empty input does nothing", async ({ page }) => {
    await openEmptyTerminal(page);

    await terminalInput(page).press("Enter");

    await expect(terminalLog(page).locator("p")).toHaveCount(2); // only the welcome and the hint
  });

  test("stops at 200 characters", async ({ page }) => {
    await openEmptyTerminal(page);
    const input = terminalInput(page);

    await input.click();
    await input.pressSequentially("a".repeat(250));

    await expect(input).toHaveValue("a".repeat(200));
  });

  test("a finance question the demo does not know gets an honest notice", async ({ page }) => {
    await openEmptyTerminal(page);

    await ask(page, "Vilken är min dyraste prenumeration?");

    const log = terminalLog(page);
    await expect(log).toContainText("→ Koll Analyst");
    await expect(log).toContainText("Demo mode only knows a few questions");
  });

  test("a question that is not about money gets no agent", async ({ page }) => {
    await openEmptyTerminal(page);

    await ask(page, "Hur mår du?");

    await expect(terminalLog(page)).toContainText("✗ no agent can handle that");
  });
});

test.describe("history and clearing", () => {
  test("arrow up and down walk through earlier questions, like a real terminal", async ({ page }) => {
    await openEmptyTerminal(page);
    await askAndWait(page, "Kategorisera mina köp");
    await askAndWait(page, "Hur mår du?");
    const input = terminalInput(page);

    await input.press("ArrowUp");
    await expect(input).toHaveValue("Hur mår du?");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("Kategorisera mina köp");
    await input.press("ArrowUp"); // already at the oldest
    await expect(input).toHaveValue("Kategorisera mina köp");
    await input.press("ArrowDown");
    await expect(input).toHaveValue("Hur mår du?");
    await input.press("ArrowDown"); // past the newest: back to empty
    await expect(input).toHaveValue("");
  });

  test('"clear" empties the terminal but keeps the welcome text', async ({ page }) => {
    await openEmptyTerminal(page);
    await askAndWait(page, "Kategorisera mina köp");
    await expect(terminalLog(page)).toContainText("Categorized 20");

    await ask(page, "clear");

    const log = terminalLog(page);
    await expect(log).not.toContainText("Categorized 20");
    await expect(log).not.toContainText("Kategorisera mina köp");
    await expect(log).toContainText("koll demo · made-up data, scripted answers");
  });

  test("keeps every question and answer in order until cleared", async ({ page }) => {
    await openEmptyTerminal(page);

    await askAndWait(page, "Kategorisera mina köp");
    await askAndWait(page, "Hur mår du?");

    const text = (await terminalLog(page).textContent()) ?? "";
    expect(text.indexOf("Kategorisera mina köp")).toBeLessThan(text.indexOf("Hur mår du?"));
  });
});

test.describe("while it is working", () => {
  test("takes one question at a time", async ({ page }) => {
    await openEmptyTerminal(page);
    // The real timing: about 3 seconds per answer, so there is time to look at the busy state
    await page.emulateMedia({ reducedMotion: "no-preference" });

    await chip(page, FOOD).click();

    await expect(page.getByLabel("Working")).toBeVisible();
    await expect(terminalInput(page)).toHaveJSProperty("readOnly", true);
    await expect(runButton(page)).toBeDisabled();
    for (const question of [FOOD, SHOPS, CATEGORIZE, WEATHER]) {
      await expect(chip(page, question)).toBeDisabled();
    }

    // ... and everything is available again when it is done
    await expect(terminalLog(page)).toContainText("Du la totalt 5 600 kronor", { timeout: 10_000 });
    await expect(page.getByLabel("Working")).toHaveCount(0);
    await expect(terminalInput(page)).toHaveJSProperty("readOnly", false);
    await expect(chip(page, SHOPS)).toBeEnabled();
  });

  test("shows the steps one after the other, not all at once", async ({ page }) => {
    await openEmptyTerminal(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    await chip(page, FOOD).click();

    // The agents line comes first; the answer is still several seconds away
    await expect(terminalLog(page)).toContainText("agents Koll Categorizer · Koll Analyst");
    await expect(terminalLog(page)).not.toContainText("Du la totalt");
    await expect(terminalLog(page)).toContainText("Du la totalt", { timeout: 10_000 });
  });
});
