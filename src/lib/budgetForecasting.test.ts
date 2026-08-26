import { describe, it, expect } from "vitest";
import { calculateBudgetForecast, ExpectedTransaction } from "./budgetForecasting";

describe("Build Interactive Budget Forecasting Tool Suite (#3879)", () => {
  const currentBalance = 2000.0;
  const startDate = new Date(2026, 7, 1); // August 2026

  it("calculates 12-month balance progression accurately with income and expenses", () => {
    const transactions: ExpectedTransaction[] = [
      {
        id: "tx1",
        clubId: "c1",
        title: "T-Shirts",
        type: "expense",
        amount: 800.0,
        projectedDateIso: "2026-08-15",
      },
      {
        id: "tx2",
        clubId: "c1",
        title: "Sponsorship Grant",
        type: "income",
        amount: 1000.0,
        projectedDateIso: "2026-09-10",
      },
    ];

    const result = calculateBudgetForecast(currentBalance, transactions, startDate);

    expect(result.monthlyForecasts.length).toBe(12);
    expect(result.monthlyForecasts[0].monthYear).toBe("Aug 2026");
    expect(result.monthlyForecasts[0].endingBalance).toBe(1200.0); // $2000 - $800 = $1200
    expect(result.monthlyForecasts[1].monthYear).toBe("Sep 2026");
    expect(result.monthlyForecasts[1].endingBalance).toBe(2200.0); // $1200 + $1000 = $2200
    expect(result.hasProjectedDeficit).toBe(false);
  });

  it("flags projected deficit when balance drops below $0 and generates warning message", () => {
    const transactions: ExpectedTransaction[] = [
      {
        id: "tx1",
        clubId: "c1",
        title: "T-Shirts",
        type: "expense",
        amount: 800.0,
        projectedDateIso: "2026-08-15",
      },
      {
        id: "tx2",
        clubId: "c1",
        title: "Annual Banquet",
        type: "expense",
        amount: 1500.0,
        projectedDateIso: "2026-11-20",
      },
    ];

    const result = calculateBudgetForecast(currentBalance, transactions, startDate);

    expect(result.hasProjectedDeficit).toBe(true);
    expect(result.deficitMonth).toBe("Nov 2026");
    expect(result.minProjectedBalance).toBe(-300.0); // $2000 - $800 = $1200 -> $1200 - $1500 = -$300
    expect(result.warningMessage).toContain("Projected Deficit Detected in Nov 2026");
  });
});
