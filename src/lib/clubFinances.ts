export interface FinancialTransaction {
  id: string;
  clubId: string;
  amount: number; // Positive for Income, Negative for Expense
  transactionType: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  receiptUrl?: string;
  createdAt: string; // ISO string
}

export interface ClubBalanceSummary {
  clubId: string;
  netBalance: number;
  totalIncome: number;
  totalExpense: number;
}

/**
  Calculates net balance, total income, and total expenses from transaction ledger.
 */
export function calculateClubBalanceSummary(
  transactions: FinancialTransaction[],
  clubId: string,
): ClubBalanceSummary {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    if (tx.transactionType === "INCOME") {
      totalIncome += Math.abs(tx.amount);
    } else if (tx.transactionType === "EXPENSE") {
      totalExpense += Math.abs(tx.amount);
    }
  }

  const netBalance = totalIncome - totalExpense;

  return {
    clubId,
    netBalance: Number(netBalance.toFixed(2)),
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
  };
}

/**
  Formats transaction ledger into CSV report string for student union auditing.
 */
export function generateAuditCsvReport(transactions: FinancialTransaction[]): string {
  const headers = [
    "Transaction ID",
    "Date",
    "Type",
    "Category",
    "Amount ($)",
    "Description",
    "Receipt URL",
  ];

  const rows = transactions.map((tx) => [
    tx.id,
    tx.createdAt,
    tx.transactionType,
    `"${tx.category}"`,
    tx.amount.toFixed(2),
    `"${tx.description.replace(/"/g, '""')}"`,
    tx.receiptUrl || "N/A",
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
