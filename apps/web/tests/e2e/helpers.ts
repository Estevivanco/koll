import { expect, type Locator, type Page } from "@playwright/test";
import { formatKr } from "../../src/lib/format";

/** The terminal's output area (the log) and its input */
export const terminalLog = (page: Page): Locator => page.getByRole("log", { name: "Terminal output" });
export const terminalInput = (page: Page): Locator => page.getByLabel("Ask Koll a question");

/**
 * The terminal runs one example by itself when it scrolls into view. Tests that need an empty
 * terminal call this before page.goto(), so the autoplay never starts.
 */
export async function withoutAutoplay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });
}

/** Opens the page with an empty terminal in view and the cursor ready */
export async function openEmptyTerminal(page: Page): Promise<void> {
  await withoutAutoplay(page);
  await page.goto("/");
  await page.locator("#terminal").scrollIntoViewIfNeeded();
}

/** Asks a question the way a visitor does: type it and press Enter */
export async function ask(page: Page, question: string): Promise<void> {
  const input = terminalInput(page);
  await input.click();
  await input.fill(question);
  await input.press("Enter");
}

/** Asks a question and waits until the terminal has finished answering it */
export async function askAndWait(page: Page, question: string): Promise<void> {
  await ask(page, question);
  await expect(terminalLog(page)).toContainText(question);
  await expect(page.getByLabel("Working")).toHaveCount(0);
}

/**
 * A text matcher for an amount in kronor. Swedish formatting puts a non-breaking space in thousands
 * ("18 310 kr"), so any kind of space matches.
 */
export function kr(amount: number): RegExp {
  return new RegExp(formatKr(amount).replace(/\s/g, "\\s"));
}

/** The row of month buttons. Exact, because "Spending per month: view" would match "Month" too. */
export const monthPicker = (page: Page): Locator => page.getByRole("group", { name: "Month", exact: true });

/** A headline number tile on the overview, found by its label */
export function tile(page: Page, label: string): Locator {
  return page.locator("#overview").getByText(label, { exact: true }).locator("..");
}
