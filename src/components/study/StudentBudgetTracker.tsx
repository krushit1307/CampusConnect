import { useState } from "react";
import {
  Wallet,
  Plus,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import {
  useStudentBudget,
  type TransactionType,
  type ExpenseCategory,
  type IncomeCategory,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "../../hooks/useStudentBudget";

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatCompact(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(0)}`;
}

interface AddTransactionModalProps {
  onAdd: (
    type: TransactionType,
    amount: number,
    category: ExpenseCategory | IncomeCategory,
    description: string,
    date: string,
  ) => void;
  onClose: () => void;
}

function AddTransactionModal({ onAdd, onClose }: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | IncomeCategory>("food");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
    onAdd(type, num, category, description, date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-sm font-bold text-slate-100">Add Transaction</h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setCategory(t === "expense" ? "food" : "salary");
                }}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl py-2.5 border transition-all capitalize ${
                  type === t
                    ? t === "expense"
                      ? "bg-red-500/15 border-red-500/30 text-red-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "expense" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                {t}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Category</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.entries(cats) as [string, { icon: string; label: string }][]).map(
                ([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key as ExpenseCategory | IncomeCategory)}
                    className={`flex flex-col items-center gap-0.5 text-[9px] rounded-xl py-2 border transition-all ${
                      category === key
                        ? type === "expense"
                          ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span className="text-sm">{val.icon}</span>
                    <span className="truncate w-full text-center px-0.5">
                      {key.length > 6 ? key.slice(0, 5) + "." : key}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Coffee at campus cafe"
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-xs text-slate-500 hover:text-slate-300 py-2.5 rounded-xl border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!amount || parseFloat(amount) <= 0}
            className={`flex-1 font-bold text-xs rounded-xl py-2.5 transition-colors text-white disabled:bg-slate-700 disabled:text-slate-500 ${
              type === "expense"
                ? "bg-red-500 hover:bg-red-400"
                : "bg-emerald-500 hover:bg-emerald-400"
            }`}
          >
            Add {type === "expense" ? "Expense" : "Income"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function StudentBudgetTracker() {
  const {
    transactions,
    stats,
    expenseBreakdown,
    monthlySummaries,
    selectedMonth,
    setSelectedMonth,
    addTransaction,
    removeTransaction,
    clearAllData,
    categories,
    incomeCategories,
  } = useStudentBudget();

  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<"overview" | "transactions">("overview");

  // Selected month's transactions
  const monthTransactions = transactions
    .filter((t) => {
      const m = new Date(t.date);
      return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}` === selectedMonth;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const monthIncome = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const monthExpenses = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Navigation helpers
  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // Max expense for bar normalization
  const maxExpense = Math.max(1, ...expenseBreakdown.map((c) => c.total));

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6 shadow-xl max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20">
            <Wallet size={18} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Student Budget</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              Track income & expenses
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl px-3 py-2 transition-all"
          >
            <Plus size={14} />
            Add
          </button>
          <button
            onClick={clearAllData}
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
            aria-label="Clear all data"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Balance Hero */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 text-center">
          <TrendingUp size={14} className="mx-auto text-emerald-400 mb-1" />
          <span className="text-lg font-black text-emerald-400 block tabular-nums">
            {formatCompact(stats.currentMonthIncome)}
          </span>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Income</span>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3.5 text-center">
          <TrendingDown size={14} className="mx-auto text-red-400 mb-1" />
          <span className="text-lg font-black text-red-400 block tabular-nums">
            {formatCompact(stats.currentMonthExpenses)}
          </span>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Expenses</span>
        </div>
        <div
          className={`border rounded-xl p-3.5 text-center ${
            stats.currentMonthNet >= 0
              ? "bg-blue-500/5 border-blue-500/20"
              : "bg-orange-500/5 border-orange-500/20"
          }`}
        >
          <DollarSign
            size={14}
            className={`mx-auto mb-1 ${
              stats.currentMonthNet >= 0 ? "text-blue-400" : "text-orange-400"
            }`}
          />
          <span
            className={`text-lg font-black block tabular-nums ${
              stats.currentMonthNet >= 0 ? "text-blue-400" : "text-orange-400"
            }`}
          >
            {formatCompact(stats.currentMonthNet)}
          </span>
          <span className="text-[9px] font-mono text-slate-500 uppercase">Net</span>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-slate-500" />
          <span className="text-xs font-bold text-slate-200">
            {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        {(["overview", "transactions"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-[10px] font-mono rounded-lg px-3 py-1.5 border transition-all capitalize ${
              view === v
                ? "bg-slate-700 border-slate-600 text-slate-200"
                : "bg-slate-800/50 border-slate-700/40 text-slate-500 hover:text-slate-300"
            }`}
          >
            {v === "overview" ? <PieChart size={10} className="inline mr-1" /> : <BarChart3 size={10} className="inline mr-1" />}
            {v}
          </button>
        ))}
      </div>

      {view === "overview" ? (
        <>
          {/* Expense Breakdown */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Spending by Category
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {formatCurrency(monthExpenses)} total
              </span>
            </div>
            {expenseBreakdown.length > 0 ? (
              <div className="space-y-2">
                {expenseBreakdown.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-sm shrink-0">{cat.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-300">{cat.category}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatCurrency(cat.total)}
                          <span className="text-slate-600 ml-1">
                            ({cat.percentage.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                          style={{ width: `${(cat.total / maxExpense) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-600">
                No expenses this month
              </div>
            )}
          </div>

          {/* Monthly History */}
          {monthlySummaries.length > 0 && (
            <div className="border-t border-slate-700/40 pt-4">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Monthly History
              </span>
              <div className="mt-2 space-y-1.5">
                {monthlySummaries.slice(-6).reverse().map((m) => (
                  <div
                    key={m.month}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-800/30"
                  >
                    <span className="text-[10px] text-slate-400">{m.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-emerald-400">
                        +{formatCompact(m.income)}
                      </span>
                      <span className="text-[10px] font-mono text-red-400">
                        -{formatCompact(m.expenses)}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          m.net >= 0 ? "text-blue-400" : "text-orange-400"
                        }`}
                      >
                        {m.net >= 0 ? "+" : ""}
                        {formatCompact(m.net)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats Footer */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-700/40">
            <div className="text-center">
              <span className="text-[9px] font-mono text-slate-600 uppercase block">Savings Rate</span>
              <span className="text-sm font-bold text-slate-200">
                {stats.savingsRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] font-mono text-slate-600 uppercase block">Top Expense</span>
              <span className="text-sm font-bold text-slate-200">{stats.topExpenseCategory}</span>
            </div>
          </div>
        </>
      ) : (
        /* Transaction List */
        <>
          {monthTransactions.length > 0 ? (
            <div className="space-y-1.5">
              {monthTransactions.map((txn) => {
                const isExpense = txn.type === "expense";
                const catInfo = isExpense
                  ? EXPENSE_CATEGORIES[txn.category as ExpenseCategory]
                  : INCOME_CATEGORIES[txn.category as IncomeCategory];

                return (
                  <div
                    key={txn.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-slate-800/40 border border-slate-700/30"
                  >
                    <span className="text-lg shrink-0">{catInfo?.icon ?? "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-200 truncate">
                          {txn.description || txn.category}
                        </span>
                        <span className="text-[9px] text-slate-600 shrink-0">
                          {new Date(txn.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600">
                        {catInfo?.label ?? txn.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isExpense ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {isExpense ? "-" : "+"}
                        {formatCurrency(txn.amount)}
                      </span>
                      <button
                        onClick={() => removeTransaction(txn.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors"
                        aria-label="Remove transaction"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <Wallet size={32} className="mx-auto text-slate-700 mb-3" />
              <p className="text-xs text-slate-500">No transactions this month</p>
              <p className="text-[10px] text-slate-600">Click "Add" to log a transaction</p>
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddTransactionModal
          onAdd={addTransaction}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
