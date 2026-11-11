import { describe, expect, it } from "vitest";
import { formatCompact, formatKr, formatPercent } from "./format";

// Swedish number format uses a non-breaking space between thousands. Treat any space as the same.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("formatKr", () => {
  it("puts a space in thousands and adds kr", () => {
    expect(plain(formatKr(18310))).toBe("18 310 kr");
  });

  it("handles small numbers, zero and millions", () => {
    expect(plain(formatKr(0))).toBe("0 kr");
    expect(plain(formatKr(999))).toBe("999 kr");
    expect(plain(formatKr(1234567))).toBe("1 234 567 kr");
  });

  it("rounds away the öre", () => {
    expect(plain(formatKr(1234.56))).toBe("1 235 kr");
  });
});

describe("formatCompact", () => {
  it.each([
    [0, "0"],
    [500, "500"],
    [999, "999"],
    [1000, "1K"],
    [5000, "5K"],
    [12500, "12.5K"],
  ])("%s becomes %s", (amount, text) => {
    expect(formatCompact(amount)).toBe(text);
  });
});

describe("formatPercent", () => {
  it("gives a whole percent", () => {
    expect(formatPercent(3, 12)).toBe("25%");
  });

  it("rounds", () => {
    expect(formatPercent(1, 3)).toBe("33%");
    expect(formatPercent(2, 3)).toBe("67%");
  });

  it("gives 0% when the total is 0, not NaN", () => {
    expect(formatPercent(5, 0)).toBe("0%");
  });

  it("handles nothing and everything", () => {
    expect(formatPercent(0, 10)).toBe("0%");
    expect(formatPercent(10, 10)).toBe("100%");
  });
});
