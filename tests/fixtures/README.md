# Test fixtures

`swedbank-sample.csv` is a made-up Swedbank export in the real format: the info line, the mangled å/ä/ö (`�`), decimal commas and spaces in thousands. **No real bank data.**

20 rows, August to October 2026, newest first. The totals the tests rely on (money out is counted as a positive number):

| What                                                      | Value                             |
| --------------------------------------------------------- | --------------------------------- |
| Rows                                                      | 20                                |
| Salary (`Lön`, +24 500 kr on the 25th)                    | 3 rows, 73 500 kr in              |
| Spent in August / September / October                     | 3 040,50 / 3 918,75 / 2 908,00 kr |
| `ICA MAXI`                                                | 5 rows, 2 782,25 kr               |
| `ESPRESSO HOUSE`                                          | 3 rows, 178 kr                    |
| `SPOTIFY` (129 kr, 1st of every month: the recurring one) | 3 rows, 387 kr                    |
| `CIRCLE K`                                                | 2 rows (52 kr and 420 kr), 472 kr |
| `PRESSBYRAN`                                              | 1 row, 48 kr                      |
| `Sparkonto` (transfers, 2 000 kr the 28th of every month) | 3 rows, 6 000 kr                  |

Charged in 3 different months (what the MCP `recurring_payments` tool finds): `Sparkonto`, `ICA MAXI`, `SPOTIFY` and `ESPRESSO HOUSE`. `CIRCLE K` (2 months) and `PRESSBYRAN` (1) are not.

If you change the CSV, change this table and the tests that use it.
