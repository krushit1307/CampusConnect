// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useStudentBudget } from "./useStudentBudget";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-10-15T12:00:00"));
});

function todayISO(): string {
  return new Date("2025-10-15T12:00:00").toISOString();
}

describe("useStudentBudget", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useStudentBudget());
    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.stats.totalIncome).toBe(0);
    expect(result.current.stats.totalExpenses).toBe(0);
    expect(result.current.stats.balance).toBe(0);
  });

  it("adds an expense", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("expense", 12.5, "food", "Lunch", todayISO());
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].amount).toBe(12.5);
    expect(result.current.transactions[0].type).toBe("expense");
    expect(result.current.stats.totalExpenses).toBe(12.5);
  });

  it("adds income", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("income", 500, "salary", "Part-time", todayISO());
    });

    expect(result.current.stats.totalIncome).toBe(500);
    expect(result.current.stats.balance).toBe(500);
  });

  it("calculates correct balance", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("income", 1000, "scholarship", "Grant", todayISO());
    });

    act(() => {
      result.current.addTransaction("expense", 250, "housing", "Rent", todayISO());
    });

    act(() => {
      result.current.addTransaction("expense", 100, "food", "Groceries", todayISO());
    });

    expect(result.current.stats.totalIncome).toBe(1000);
    expect(result.current.stats.totalExpenses).toBe(350);
    expect(result.current.stats.balance).toBe(650);
  });

  it("removes a transaction", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("expense", 20, "food", "Snacks", todayISO());
    });

    const id = result.current.transactions[0].id;

    act(() => {
      result.current.removeTransaction(id);
    });

    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.stats.totalExpenses).toBe(0);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("expense", 45, "books", "Textbook", todayISO());
    });

    const stored = JSON.parse(localStorage.getItem("cc-student-budget") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].amount).toBe(45);
  });

  it("computes expense breakdown", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("expense", 30, "food", "Pizza", todayISO());
    });

    act(() => {
      result.current.addTransaction("expense", 20, "food", "Coffee", todayISO());
    });

    act(() => {
      result.current.addTransaction("expense", 50, "transport", "Bus pass", todayISO());
    });

    expect(result.current.expenseBreakdown).toHaveLength(2);
    // Food should be first (50 total) > Transport (50 total) — same, but food added first
    const food = result.current.expenseBreakdown.find((b) => b.category === "food");
    const transport = result.current.expenseBreakdown.find((b) => b.category === "transport");
    expect(food?.total).toBe(50);
    expect(food?.count).toBe(2);
    expect(transport?.total).toBe(50);
    expect(transport?.count).toBe(1);
  });

  it("computes savings rate", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("income", 1000, "salary", "Job", todayISO());
    });

    act(() => {
      result.current.addTransaction("expense", 600, "housing", "Rent", todayISO());
    });

    // savings rate = (1000 - 600) / 1000 * 100 = 40%
    expect(result.current.stats.savingsRate).toBeCloseTo(40, 0);
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("expense", 25, "food", "Dinner", todayISO());
    });

    act(() => {
      result.current.clearAllData();
    });

    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.stats.totalExpenses).toBe(0);
  });

  it("computes monthly summaries", () => {
    const { result } = renderHook(() => useStudentBudget());

    act(() => {
      result.current.addTransaction("income", 500, "salary", "Oct income", todayISO());
    });

    act(() => {
      result.current.addTransaction("expense", 200, "food", "Oct expense", todayISO());
    });

    expect(result.current.monthlySummaries.length).toBeGreaterThanOrEqual(1);
    const oct = result.current.monthlySummaries.find((m) => m.month === "2025-10");
    expect(oct).toBeDefined();
    expect(oct!.income).toBe(500);
    expect(oct!.expenses).toBe(200);
    expect(oct!.net).toBe(300);
  });
});
