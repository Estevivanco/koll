import { describe, expect, it } from "vitest";
import { parseSwedbank } from "./swedbank.js";

// Swedbank's real column order. The header text is ignored by the parser, so any header works.
const HEADER =
  "Radnummer,Clearingnummer,Kontonummer,Produkt,Valuta,Bokf�ringsdag,Transaktionsdag,Valutadag,Referens,Beskrivning,Belopp,Bokf�rt saldo";

// All data below is made up
function line(o: {
  date?: string;
  reference?: string;
  description?: string;
  amount?: string;
  balance?: string;
}) {
  const {
    date = "2026-10-01",
    reference = "Kortk�p",
    description = "ICA MAXI",
    amount = "-100,00",
    balance = "5000,00",
  } = o;
  return `1,8000,123456789,Privatkonto,SEK,${date},${date},${date},"${reference}","${description}","${amount}","${balance}"`;
}

const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

describe("parseSwedbank", () => {
  it("reads a row into a transaction", () => {
    const [t] = parseSwedbank(
      csv(line({ date: "2026-10-03", description: "ICA MAXI", reference: "Kortköp", amount: "-249,50" })),
    );

    expect(t).toMatchObject({
      date: "2026-10-03",
      amount: -249.5,
      counterparty: "ICA MAXI",
      description: "Kortköp",
      source: "swedbank",
    });
  });

  it("skips Swedbank's info line when the file starts with one", () => {
    const withInfo = "* Transaktioner Period 2026-10-01 -- 2026-10-31\n" + csv(line({}));
    expect(parseSwedbank(withInfo)).toHaveLength(1);
  });

  it("reads files with Windows line endings", () => {
    expect(parseSwedbank(csv(line({}), line({ date: "2026-10-02" })).replaceAll("\n", "\r\n"))).toHaveLength(
      2,
    );
  });

  it("ignores empty lines", () => {
    expect(parseSwedbank(csv(line({})) + "\n\n\n")).toHaveLength(1);
  });

  it("returns nothing for a file with only a header", () => {
    expect(parseSwedbank(HEADER)).toEqual([]);
  });

  describe("amounts", () => {
    const amountOf = (amount: string) => parseSwedbank(csv(line({ amount })))[0].amount;

    it("turns the decimal comma into a decimal point", () => {
      expect(amountOf("-249,50")).toBe(-249.5);
    });

    it("removes the space in thousands", () => {
      expect(amountOf("-1 234,50")).toBe(-1234.5);
    });

    it("removes a non-breaking space in thousands", () => {
      expect(amountOf("-1 234,50")).toBe(-1234.5);
    });

    it("keeps money in positive", () => {
      expect(amountOf("25 000,00")).toBe(25000);
    });
  });

  describe("å/ä/ö", () => {
    it("fixes the mangled words it knows", () => {
      const [t] = parseSwedbank(csv(line({ description: "L�n", reference: "�verf�ring" })));
      expect(t.counterparty).toBe("Lön");
      expect(t.description).toBe("Överföring");
    });

    it("fixes a known word inside a longer text", () => {
      const [t] = parseSwedbank(csv(line({ description: "SKADEF�RS AB" })));
      expect(t.counterparty).toBe("SKADEFÖRS AB");
    });

    it("leaves words it does not know alone", () => {
      const [t] = parseSwedbank(csv(line({ description: "OK�NT" })));
      expect(t.counterparty).toBe("OK�NT");
    });
  });

  describe("id", () => {
    it("is the same when the same row is read twice (so re-imports make no duplicates)", () => {
      const file = csv(line({}));
      expect(parseSwedbank(file)[0].id).toBe(parseSwedbank(file)[0].id);
    });

    it("is 16 hex characters", () => {
      expect(parseSwedbank(csv(line({})))[0].id).toMatch(/^[0-9a-f]{16}$/);
    });

    it("differs when only the balance differs (two identical purchases on one day)", () => {
      const [a, b] = parseSwedbank(csv(line({ balance: "5000,00" }), line({ balance: "4900,00" })));
      expect(a.id).not.toBe(b.id);
    });

    it("differs when the amount, date or counterparty differs", () => {
      const base = parseSwedbank(csv(line({})))[0].id;
      expect(parseSwedbank(csv(line({ amount: "-101,00" })))[0].id).not.toBe(base);
      expect(parseSwedbank(csv(line({ date: "2026-10-02" })))[0].id).not.toBe(base);
      expect(parseSwedbank(csv(line({ description: "COOP" })))[0].id).not.toBe(base);
    });
  });

  describe("bad rows", () => {
    it("throws when the amount is not a number", () => {
      expect(() => parseSwedbank(csv(line({ amount: "abc" })))).toThrow(/Bad row/);
    });

    it("throws when the date is missing", () => {
      expect(() => parseSwedbank(csv(line({ date: "" })))).toThrow(/Bad row/);
    });

    // Number("") is 0, so an empty amount slips through as 0 kr instead of being rejected.
    it.todo("throws when the amount is empty (today it is read as 0)");
  });
});
