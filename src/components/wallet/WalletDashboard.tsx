// =============================================================================
// Component: WalletDashboard
// Issue: #2813 - Implement an In - App Wallet for Gamification Points
// Description: Displays the user's ConnectCoin balance, lifetime stats,
// and a chronological ledger of all wallet transactions.
// =============================================================================

import React from "react";
import { useWallet, WalletTransaction } from "../../hooks/useWallet";

export const WalletDashboard: React.FC = () => {
  const { balance, transactions, isLoading, error } = useWallet();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 p-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
        Error loading wallet: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>

        <div className="relative z-10">
          <p className="text-indigo-200 text-sm font-medium uppercase tracking-wider mb-2">
            Current Balance
          </p>
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-5xl font-black">{balance?.balance.toLocaleString() || 0}</span>
            <span className="text-2xl font-bold text-indigo-200">ConnectCoins</span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/20">
            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wider mb-1">
                Lifetime Earned
              </p>
              <p className="text-xl font-bold">+{balance?.lifetime_earned.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wider mb-1">
                Lifetime Spent
              </p>
              <p className="text-xl font-bold">-{balance?.lifetime_spent.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="font-bold text-gray-900 dark:text-white">Transaction History</h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <p className="text-sm">No transactions yet. Attend events to earn ConnectCoins!</p>
            </div>
          ) : (
            transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Individual Transaction Row Component
 */
const TransactionRow: React.FC<{ transaction: WalletTransaction }> = ({ transaction }) => {
  const isCredit = transaction.amount > 0;

  const getIcon = () => {
    switch (transaction.transaction_type) {
      case "earn":
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
        );
      case "purchase":
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      {getIcon()}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {transaction.description}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {new Date(transaction.created_at).toLocaleString()}
        </p>
      </div>

      <div className="text-right">
        <p
          className={`text-sm font-bold ${isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {isCredit ? "+" : ""}
          {transaction.amount}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Bal: {transaction.balance_after}</p>
      </div>
    </div>
  );
};
