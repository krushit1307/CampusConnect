import { useState } from "react";
import { useClubBudget } from "@/hooks/useClubBudget";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import PiggyBank from "lucide-react/dist/esm/icons/piggy-bank";
import Plus from "lucide-react/dist/esm/icons/plus";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import XCircle from "lucide-react/dist/esm/icons/xcircle";
import { toast } from "sonner";

interface ClubBudgetDashboardProps {
  clubId: string;
}

export function ClubBudgetDashboard({ clubId }: ClubBudgetDashboardProps) {
  const { summary, transactions, isLoading, createTransaction, updateTransactionStatus } =
    useClubBudget(clubId);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!formDescription.trim()) {
      toast.error("Enter a description");
      return;
    }
    createTransaction.mutate(
      {
        club_id: clubId,
        type: formType,
        amount,
        description: formDescription.trim(),
        category: formCategory.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setFormAmount("");
          setFormDescription("");
          setFormCategory("");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 border-2 border-black bg-gray-100 dark:bg-zinc-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-black bg-cream p-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-800 dark:border-white">
        <div>
          <h2 className="font-display font-black text-xl uppercase tracking-wide flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-600" />
            Club Budget &amp; Finances
          </h2>
          <p className="font-mono text-xs text-gray-600 dark:text-gray-300 mt-1">
            {summary?.refreshed_at
              ? `Data updated as of ${new Date(summary.refreshed_at).toLocaleString()}`
              : "Budget and expense tracking overview."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="neu-border neu-press bg-lime text-black px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 hover:-translate-y-1 transition-transform"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Add Transaction"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4"
        >
          <h3 className="font-display font-black text-base uppercase">New Transaction</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormType("expense")}
              className={`px-4 py-2 font-mono text-xs font-bold uppercase border-2 border-black ${
                formType === "expense"
                  ? "bg-red-500 text-white"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setFormType("income")}
              className={`px-4 py-2 font-mono text-xs font-bold uppercase border-2 border-black ${
                formType === "income"
                  ? "bg-green-500 text-white"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              Income
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-mono text-xs font-bold uppercase mb-1 block">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="neu-border w-full p-2 font-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold uppercase mb-1 block">Category</label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. supplies, venue, food"
                className="neu-border w-full p-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold uppercase mb-1 block">
                Description
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What is this for?"
                className="neu-border w-full p-2 font-mono text-sm"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createTransaction.isPending}
            className="neu-border neu-press w-full bg-black text-white p-3 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 disabled:opacity-50"
          >
            {createTransaction.isPending ? "Submitting..." : "Submit Transaction"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border-2 border-black bg-green-100 p-4 shadow-[4px_4px_0_0_#000] dark:bg-green-900/20 dark:border-white">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
              Total Budget
            </span>
            <PiggyBank className="h-5 w-5 text-green-700" />
          </div>
          <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
            ${(summary?.total_budget ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
            Annual allocation
          </p>
        </div>

        <div className="border-2 border-black bg-blue-100 p-4 shadow-[4px_4px_0_0_#000] dark:bg-blue-900/20 dark:border-white">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
              Total Income
            </span>
            <TrendingUp className="h-5 w-5 text-blue-700" />
          </div>
          <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
            +${(summary?.total_income ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
            Sponsorships &amp; revenue
          </p>
        </div>

        <div className="border-2 border-black bg-red-100 p-4 shadow-[4px_4px_0_0_#000] dark:bg-red-900/20 dark:border-white">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
              Total Expenses
            </span>
            <TrendingDown className="h-5 w-5 text-red-700" />
          </div>
          <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
            -${(summary?.total_expenses ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
            {summary?.transaction_count ?? 0} transactions
          </p>
        </div>

        <div className="border-2 border-black bg-purple-100 p-4 shadow-[4px_4px_0_0_#000] dark:bg-purple-900/20 dark:border-white">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-black dark:text-cream">
              Remaining Balance
            </span>
            <Receipt className="h-5 w-5 text-purple-700" />
          </div>
          <p className="font-display font-black text-3xl mt-2 text-black dark:text-white">
            $
            {(summary?.remaining_balance ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </p>
          <p className="mt-2 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300 border-t border-black/20 pt-1">
            Net available funds
          </p>
        </div>
      </div>

      <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3 dark:border-white">
          <div>
            <h3 className="font-display font-black text-lg uppercase flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Recent Transactions
            </h3>
            <p className="font-mono text-xs text-gray-500">
              Latest 50 approved income and expense entries.
            </p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="h-32 flex items-center justify-center font-mono text-xs text-gray-400">
            No transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-black text-white">
                  <th className="p-2 border-r border-white">Date</th>
                  <th className="p-2 border-r border-white">Type</th>
                  <th className="p-2 border-r border-white">Description</th>
                  <th className="p-2 border-r border-white">Category</th>
                  <th className="p-2 border-r border-white">Amount</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                    <td className="p-2 border-r border-black/30 whitespace-nowrap">
                      {new Date(txn.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="p-2 border-r border-black/30">
                      <span
                        className={`inline-block px-2 py-0.5 font-bold text-[10px] uppercase ${
                          txn.type === "income"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {txn.type}
                      </span>
                    </td>
                    <td className="p-2 border-r border-black/30 max-w-[200px] truncate">
                      {txn.description}
                    </td>
                    <td className="p-2 border-r border-black/30">
                      {txn.category ? (
                        <span className="bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase dark:bg-zinc-700">
                          {txn.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td
                      className={`p-2 border-r border-black/30 font-bold ${
                        txn.type === "income" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {txn.type === "income" ? "+" : "-"}$
                      {txn.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2">
                      {txn.status === "approved" && (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-3 w-3" /> Approved
                        </span>
                      )}
                      {txn.status === "pending" && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                      {txn.status === "rejected" && (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3 w-3" /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
