import { useState, useCallback, useEffect, useMemo } from "react";

export type TransactionType = "income" | "expense";

export type ExpenseCategory =
  | "food"
  | "transport"
  | "housing"
  | "books"
  | "entertainment"
  | "health"
  | "clothing"
  | "utilities"
  | "savings"
  | "other";

export type IncomeCategory =
  | "salary"
  | "scholarship"
  | "freelance"
  | "family"
  | "financial-aid"
  | "other";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: ExpenseCategory | IncomeCategory;
  description: string;
  date: string; // ISO date string
  createdAt: string;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  percentage: number;
  count: number;
  icon: string;
  color: string;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  label: string; // "Oct 2025"
  income: number;
  expenses: number;
  net: number;
}

export interface BudgetStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  currentMonthIncome: number;
  currentMonthExpenses: number;
  currentMonthNet: number;
  avgMonthlyExpenses: number;
  savingsRate: number;
  topExpenseCategory: string;
  transactionCount: number;
}

const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  food: { label: "Food & Dining", icon: "🍔", color: "text-orange-400" },
  transport: { label: "Transport", icon: "🚌", color: "text-blue-400" },
  housing: { label: "Housing & Rent", icon: "🏠", color: "text-violet-400" },
  books: { label: "Books & Supplies", icon: "📚", color: "text-amber-400" },
  entertainment: { label: "Entertainment", icon: "🎮", color: "text-pink-400" },
  health: { label: "Health & Fitness", icon: "💊", color: "text-emerald-400" },
  clothing: { label: "Clothing", icon: "👕", color: "text-cyan-400" },
  utilities: { label: "Utilities & Bills", icon: "💡", color: "text-yellow-400" },
  savings: { label: "Savings", icon: "🏦", color: "text-green-400" },
  other: { label: "Other", icon: "📌", color: "text-slate-400" },
};

const INCOME_CATEGORIES: Record<IncomeCategory, { label: string; icon: string; color: string }> = {
  salary: { label: "Part-Time Job", icon: "💼", color: "text-emerald-400" },
  scholarship: { label: "Scholarship", icon: "🎓", color: "text-blue-400" },
  freelance: { label: "Freelance", icon: "💻", color: "text-violet-400" },
  family: { label: "Family Support", icon: "👨‍👩‍👧", color: "text-pink-400" },
  "financial-aid": { label: "Financial Aid", icon: "🏦", color: "text-cyan-400" },
  other: { label: "Other Income", icon: "💰", color: "text-slate-400" },
};

const STORAGE_KEY = "cc-student-budget";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTransactions(txns: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
}

export interface UseStudentBudgetReturn {
  transactions: Transaction[];
  stats: BudgetStats;
  expenseBreakdown: CategoryBreakdown[];
  monthlySummaries: MonthlySummary[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  addTransaction: (
    type: TransactionType,
    amount: number,
    category: ExpenseCategory | IncomeCategory,
    description: string,
    date: string,
  ) => void;
  removeTransaction: (id: string) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  clearAllData: () => void;
  categories: typeof EXPENSE_CATEGORIES;
  incomeCategories: typeof INCOME_CATEGORIES;
}

export function useStudentBudget(): UseStudentBudgetReturn {
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  const stats = useMemo((): BudgetStats => {
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const cm = currentMonth();
    const currentMonthTxns = transactions.filter((t) => toMonth(t.date) === cm);
    const currentMonthIncome = currentMonthTxns
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const currentMonthExpenses = currentMonthTxns
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    // Unique months
    const months = new Set(transactions.map((t) => toMonth(t.date)));
    const monthCount = Math.max(1, months.size);
    const avgMonthlyExpenses = totalExpenses / monthCount;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    // Top expense category
    const catTotals: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
      });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      currentMonthIncome,
      currentMonthExpenses,
      currentMonthNet: currentMonthIncome - currentMonthExpenses,
      avgMonthlyExpenses,
      savingsRate,
      topExpenseCategory: topCat
        ? EXPENSE_CATEGORIES[topCat[0] as ExpenseCategory]?.label ?? topCat[0]
        : "None",
      transactionCount: transactions.length,
    };
  }, [transactions]);

  const expenseBreakdown = useMemo((): CategoryBreakdown[] => {
    const sm = selectedMonth;
    const monthExpenses = transactions.filter(
      (t) => t.type === "expense" && toMonth(t.date) === sm,
    );

    const total = monthExpenses.reduce((sum, t) => sum + t.amount, 0);
    const catMap: Record<string, { total: number; count: number }> = {};

    monthExpenses.forEach((t) => {
      if (!catMap[t.category]) catMap[t.category] = { total: 0, count: 0 };
      catMap[t.category].total += t.amount;
      catMap[t.category].count++;
    });

    return Object.entries(catMap)
      .map(([cat, data]) => ({
        category: cat,
        total: data.total,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
        count: data.count,
        icon: EXPENSE_CATEGORIES[cat as ExpenseCategory]?.icon ?? "📌",
        color: EXPENSE_CATEGORIES[cat as ExpenseCategory]?.color ?? "text-slate-400",
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, selectedMonth]);

  const monthlySummaries = useMemo((): MonthlySummary[] => {
    const monthMap: Record<string, { income: number; expenses: number }> = {};

    transactions.forEach((t) => {
      const m = toMonth(t.date);
      if (!monthMap[m]) monthMap[m] = { income: 0, expenses: 0 };
      if (t.type === "income") {
        monthMap[m].income += t.amount;
      } else {
        monthMap[m].expenses += t.amount;
      }
    });

    return Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        label: monthLabel(month),
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
      }));
  }, [transactions]);

  const addTransaction = useCallback(
    (
      type: TransactionType,
      amount: number,
      category: ExpenseCategory | IncomeCategory,
      description: string,
      date: string,
    ) => {
      const newTxn: Transaction = {
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        amount: Math.abs(amount),
        category,
        description: description.trim(),
        date,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [...prev, newTxn]);
    },
    [],
  );

  const removeTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTransaction = useCallback(
    (id: string, patch: Partial<Omit<Transaction, "id">>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const clearAllData = useCallback(() => {
    setTransactions([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    transactions,
    stats,
    expenseBreakdown,
    monthlySummaries,
    selectedMonth,
    setSelectedMonth,
    addTransaction,
    removeTransaction,
    updateTransaction,
    clearAllData,
    categories: EXPENSE_CATEGORIES,
    incomeCategories: INCOME_CATEGORIES,
  };
}

export { EXPENSE_CATEGORIES, INCOME_CATEGORIES };
