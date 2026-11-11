import { describe, expect, it } from "vitest";
import { checkSql } from "../src/sql-guard.js";

describe("checkSql", () => {
  describe("allowed", () => {
    it("lets a plain SELECT through", () => {
      expect(checkSql("SELECT 1")).toBe("SELECT 1");
    });

    it("lets a WITH query through", () => {
      expect(checkSql("WITH a AS (SELECT 1) SELECT * FROM a")).toContain("WITH a");
    });

    it("ignores upper and lower case", () => {
      expect(() => checkSql("select 1")).not.toThrow();
      expect(() => checkSql("With a As (select 1) select * from a")).not.toThrow();
    });

    it("removes surrounding whitespace and new lines", () => {
      expect(checkSql("  \n SELECT 1 \n ")).toBe("SELECT 1");
    });

    it("removes one trailing semicolon, with or without spaces after it", () => {
      expect(checkSql("SELECT 1;")).toBe("SELECT 1");
      expect(checkSql("SELECT 1;  \n")).toBe("SELECT 1");
    });
  });

  describe("refused: more than one statement", () => {
    it("refuses a second statement", () => {
      expect(() => checkSql("SELECT 1; DROP TABLE transactions")).toThrow("Only one SQL statement");
    });

    it("refuses a second statement even when it also ends with a semicolon", () => {
      expect(() => checkSql("SELECT 1; SELECT 2;")).toThrow("Only one SQL statement");
    });

    it("refuses a change hidden behind a SELECT", () => {
      expect(() => checkSql("SELECT 1;DELETE FROM transactions;")).toThrow("Only one SQL statement");
    });

    // Too strict, on purpose: it can't tell a ; in the text from a ; between statements
    it("also refuses a semicolon inside a text value", () => {
      expect(() => checkSql("SELECT * FROM transactions WHERE counterparty ILIKE '%a;b%'")).toThrow(
        "Only one SQL statement",
      );
    });
  });

  describe("refused: not a SELECT", () => {
    it.each([
      "INSERT INTO transactions VALUES (1)",
      "UPDATE transactions SET amount = 0",
      "DELETE FROM transactions",
      "DROP TABLE transactions",
      "TRUNCATE transactions",
      "EXPLAIN ANALYZE SELECT 1",
      "",
    ])("refuses %j", (sql) => {
      expect(() => checkSql(sql)).toThrow("Only SELECT queries are allowed");
    });

    it("refuses a word that only starts with select", () => {
      expect(() => checkSql("SELECTED 1")).toThrow("Only SELECT queries are allowed");
      expect(() => checkSql("WITHOUT 1")).toThrow("Only SELECT queries are allowed");
    });

    it("refuses a query that starts with a comment or a bracket", () => {
      expect(() => checkSql("-- hi\nSELECT 1")).toThrow("Only SELECT queries are allowed");
      expect(() => checkSql("(SELECT 1)")).toThrow("Only SELECT queries are allowed");
    });
  });

  // This text check can't see that the WITH query changes data. Postgres refuses it later: runReadOnly wraps the
  // SQL in a subquery, where a data-changing WITH is an error. That, and the READ ONLY transaction and the
  // read-only analyst login, are proved in tests/integration/runReadOnly.int.test.ts (needs a real Postgres).
  it("lets a data-changing WITH query through (a later layer refuses it)", () => {
    expect(() => checkSql("WITH x AS (DELETE FROM transactions RETURNING *) SELECT * FROM x")).not.toThrow();
  });
});
