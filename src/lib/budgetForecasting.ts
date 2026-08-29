export interface ExpectedTransaction {
  id: string;
  clubId: string;
  title: string;
  type: "income" | "expense";
  amount: number;
  projectedDateIso: string; // ISO YYYY-MM-DD
}

export interface MonthlyForecastPoint {
  monthYear: string; // e.g., "Nov 2026"
  startingBalance: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
  hasDeficit: boolean;
}

export interface BudgetForecastResult {
  currentBalance: number;
  monthlyForecasts: MonthlyForecastPoint[];
  hasProjectedDeficit: boolean;
  deficitMonth: string | null;
  warningMessage: string | null;
  minProjectedBalance: number;
}

/**
 * Iteratively projects club financial balance over a 12-month horizon by applying expected transactions chronologically.
 */
export function calculateBudgetForecast(
  currentBalance: number,
  expectedTransactions: ExpectedTransaction[],
  startDate: Date = new Date(2026, 7, 1), // Default Aug 2026
): BudgetForecastResult {
  const sortedTx = [...expectedTransactions].sort(
    (a, b) => new Date(a.projectedDateIso).getTime() - new Date(b.projectedDateIso).getTime(),
  );

  let runningBalance = currentBalance;
  let hasProjectedDeficit = false;
  let deficitMonth: string | null = null;
  let minProjectedBalance = currentBalance;

  const monthlyForecasts: MonthlyForecastPoint[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const monthYear = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const monthTx = sortedTx.filter((tx) => {
      const txDate = new Date(tx.projectedDateIso);
      return txDate.getFullYear() === year && txDate.getMonth() === monthIndex;
    });

    let totalIncome = 0;
    let totalExpense = 0;

    for (const tx of monthTx) {
      if (tx.type === "income") {
        totalIncome += tx.amount;
      } else {
        totalExpense += tx.amount;
      }
    }

    const startingBalance = runningBalance;
    runningBalance = startingBalance + totalIncome - totalExpense;

    if (runningBalance < minProjectedBalance) {
      minProjectedBalance = runningBalance;
    }

    const monthDeficit = runningBalance < 0;
    if (monthDeficit && !hasProjectedDeficit) {
      hasProjectedDeficit = true;
      deficitMonth = monthYear;
    }

    monthlyForecasts.push({
      monthYear,
      startingBalance: Number(startingBalance.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      endingBalance: Number(runningBalance.toFixed(2)),
      hasDeficit: monthDeficit,
    });
  }

  const warningMessage =
    hasProjectedDeficit && deficitMonth
      ? `Projected Deficit Detected in ${deficitMonth}. Ending balance drops to $${minProjectedBalance.toFixed(2)}.`
      : null;

  return {
    currentBalance: Number(currentBalance.toFixed(2)),
    monthlyForecasts,
    hasProjectedDeficit,
    deficitMonth,
    warningMessage,
    minProjectedBalance: Number(minProjectedBalance.toFixed(2)),
  };
}
