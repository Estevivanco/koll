import type { Transaction } from "@koll/shared";
import { describe, expect, it } from "vitest";
import { applyRules } from "./rules.js";

// Money out is negative, so spending 400 kr is amount -400
let counter = 0;
function tx(counterparty: string, spent: number): Transaction {
  return {
    id: `t${++counter}`,
    date: "2026-10-01",
    amount: -spent,
    counterparty,
    description: "",
    source: "swedbank",
  };
}

// The category the rules give, or "rest" if they leave it to the AI
function categoryOf(counterparty: string, spent: number): string {
  const { matched, rest } = applyRules([tx(counterparty, spent)]);
  return matched[0]?.category ?? (rest.length ? "rest" : "?");
}

describe("applyRules", () => {
  describe("splitting", () => {
    it("sends rule matches to matched and everything else to rest", () => {
      const csn = tx("CSN", 3000);
      const unknown = tx("OKÄND BUTIK", 80);
      const { matched, rest } = applyRules([csn, unknown]);

      expect(matched).toEqual([{ id: csn.id, category: "Studiemedel" }]);
      expect(rest).toEqual([unknown]);
    });

    it("handles an empty list", () => {
      expect(applyRules([])).toEqual({ matched: [], rest: [] });
    });

    it("matches ignoring upper and lower case", () => {
      expect(categoryOf("espresso house", 45)).toBe("Restaurang");
    });
  });

  describe("salary", () => {
    it("treats 15 000 kr or more in from Circle K as Lön", () => {
      expect(categoryOf("CIRCLE K", -20000)).toBe("Lön");
      expect(categoryOf("CIRCLE K", -15000)).toBe("Lön");
    });

    it("does not treat smaller money in from Circle K as Lön", () => {
      expect(categoryOf("CIRCLE K", -14999)).toBe("rest");
    });

    it("treats money in labelled Lön as Lön", () => {
      expect(categoryOf("Lön", -24000)).toBe("Lön");
    });

    it("does not treat spending at a place called Lön as Lön", () => {
      expect(categoryOf("Lön", 100)).toBe("rest");
    });
  });

  describe("Circle K depends on the price", () => {
    it.each([
      [30, "Mat"],
      [44.9, "Mat"],
      [45, "Tobak"],
      [50, "Tobak"],
      [55, "Tobak"],
      [55.1, "Mat"],
      [120, "Mat"],
      [349.9, "Mat"],
      [350, "Transport"],
      [1200, "Transport"],
    ])("%s kr is %s", (spent, category) => {
      expect(categoryOf("CIRCLE K", spent)).toBe(category);
    });

    it("leaves a refund to the AI", () => {
      expect(categoryOf("CIRCLE K", -20)).toBe("rest");
    });
  });

  describe("Pressbyrån", () => {
    it.each([
      [20, "Mat"],
      [44.9, "Mat"],
      [45, "Tobak"],
      [55, "Tobak"],
      [55.1, "rest"],
      [200, "rest"],
    ])("%s kr is %s", (spent, category) => {
      expect(categoryOf("PRESSBYRAN 1234", spent)).toBe(category);
    });
  });

  describe("fixed merchants", () => {
    it.each([
      ["ESPRESSO HOUSE STOCKHOLM", "Restaurang"],
      ["DJURGÅRDSBRUNN", "Restaurang"],
      ["DJURGARDSBRUNN", "Restaurang"], // how the bank writes it
      ["ENSKEDE RACKETH", "Nöje"], // the bank cuts the name short
      ["SKOGAS RACKETHALL", "Nöje"],
      ["CHUBB EUROPEAN GROUP", "Prenumeration"],
      ["CSN", "Studiemedel"],
    ])("%s is %s", (counterparty, category) => {
      expect(categoryOf(counterparty, 100)).toBe(category);
    });
  });

  it("leaves unknown merchants to the AI", () => {
    expect(categoryOf("ICA MAXI", 350)).toBe("rest");
  });
});
