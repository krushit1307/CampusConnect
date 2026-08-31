// =============================================================================
// Component: PlatformCreditLedgerWidget
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Displays user platform credit balance, lifetime bonuses earned,
// pending event cancellation refund claims, and full immutable audit ledger.
// =============================================================================

import React, { useState } from "react";
import { usePlatformCredit } from "../../hooks/usePlatformCredit";
import { EventCancellationRefundChoiceModal } from "../events/EventCancellationRefundChoiceModal";
import type { CancellationRefundClaim, PlatformCreditLedgerEntry } from "../../types/platformCredit";

export const PlatformCreditLedgerWidget: React.FC = () => {
  const {
    balance,
    balanceDollars,
    ledger,
    pendingClaims,
    isLoading,
    error,
    resolveClaim,
    refresh,
  } = usePlatformCredit();

  const [activeClaim, setActiveClaim] = useState<CancellationRefundClaim | null>(null);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-6 bg-slate-900 rounded-2xl border border-slate-800">
        <div className="h-28 bg-slate-800 rounded-xl"></div>
        <div className="h-20 bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl text-xs text-red-400">
        Failed to load platform credit: {error}
      </div>
    );
  }

  const lifetimeBonusDollars = balance ? (balance.bonus_earned_cents / 100).toFixed(2) : "0.00";
  const lifetimeSpentDollars = balance ? (balance.lifetime_spent_cents / 100).toFixed(2) : "0.00";

  return (
    <div className="space-y-6">
      {/* Platform Balance Card */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full -mr-24 -mt-24 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full -ml-20 -mb-20 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-emerald-200 text-xs font-bold uppercase tracking-wider">
              CampusConnect Platform Balance
            </span>
            <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-extrabold uppercase rounded-full backdrop-blur-md">
              Internal Ledger
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-4xl sm:text-5xl font-black">${balanceDollars.toFixed(2)}</span>
            <span className="text-sm font-semibold text-emerald-100">USD Credit</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/20 text-xs">
            <div>
              <p className="text-emerald-200 uppercase tracking-wider text-[10px]">Cancellation Bonus</p>
              <p className="text-base font-bold text-emerald-100">+${lifetimeBonusDollars}</p>
            </div>
            <div>
              <p className="text-emerald-200 uppercase tracking-wider text-[10px]">Lifetime Spent</p>
              <p className="text-base font-bold text-white">${lifetimeSpentDollars}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-emerald-200 uppercase tracking-wider text-[10px]">Auto-Checkout</p>
              <p className="text-xs font-semibold text-emerald-200">Automatically applied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Cancellation Refund Claims Banner */}
      {pendingClaims.length > 0 && (
        <div className="bg-amber-950/40 border-2 border-amber-500/40 rounded-2xl p-5 text-white space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="font-bold text-sm text-amber-200">
              Pending Refund Choice{pendingClaims.length > 1 ? "s" : ""} ({pendingClaims.length})
            </h4>
          </div>

          <div className="space-y-2">
            {pendingClaims.map((claim) => {
              const orig = (claim.original_amount_cents / 100).toFixed(2);
              const cred = (claim.credit_amount_cents / 100).toFixed(2);
              return (
                <div
                  key={claim.id}
                  className="bg-slate-900/80 border border-amber-500/30 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{claim.event_title || "Cancelled Event"}</p>
                    <p className="text-[11px] text-slate-300">
                      Choose between <strong>${orig} Card Refund</strong> or{" "}
                      <strong className="text-emerald-400">${cred} Credit (+10% Bonus)</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveClaim(claim)}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold rounded-lg transition shrink-0 shadow-md"
                  >
                    Select Option
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Internal Credit Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-white">Platform Credit Ledger</h4>
            <p className="text-[11px] text-slate-400">Separate internal user wallet ledger</p>
          </div>
          <button
            onClick={() => refresh()}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Refresh
          </button>
        </div>

        {ledger.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <svg
              className="w-10 h-10 mx-auto mb-2 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            No ledger transactions yet. Platform credits from event cancellations will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
            {ledger.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Refund Choice Modal */}
      {activeClaim && (
        <EventCancellationRefundChoiceModal
          claim={activeClaim}
          isOpen={true}
          onClose={() => setActiveClaim(null)}
          onSelectChoice={resolveClaim}
          onSuccess={() => setActiveClaim(null)}
        />
      )}
    </div>
  );
};

const LedgerRow: React.FC<{ entry: PlatformCreditLedgerEntry }> = ({ entry }) => {
  const isCredit = entry.amount_cents > 0;
  const formattedAmount = `${isCredit ? "+" : ""}$${(entry.amount_cents / 100).toFixed(2)}`;
  const balanceAfter = (entry.balance_after_cents / 100).toFixed(2);
  const dateFormatted = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const getBadge = (type: string) => {
    switch (type) {
      case "cancellation_credit":
        return (
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/30">
            Cancellation Credit
          </span>
        );
      case "checkout_deduction":
        return (
          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md border border-indigo-500/30">
            Checkout Deduction
          </span>
        );
      case "credit_bonus":
        return (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-md border border-amber-500/30">
            Bonus Credit
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-[10px] font-bold rounded-md">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="p-3.5 hover:bg-slate-800/40 transition flex items-center justify-between text-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {getBadge(entry.transaction_type)}
          <span className="text-[11px] text-slate-400">{dateFormatted}</span>
        </div>
        <p className="text-white font-medium">{entry.description}</p>
        {entry.bonus_amount_cents > 0 && (
          <p className="text-[10px] text-emerald-400 font-semibold">
            Includes +${(entry.bonus_amount_cents / 100).toFixed(2)} cancellation bonus (10%)
          </p>
        )}
      </div>

      <div className="text-right shrink-0 ml-4">
        <div
          className={`font-mono font-black text-sm ${
            isCredit ? "text-emerald-400" : "text-slate-200"
          }`}
        >
          {formattedAmount}
        </div>
        <div className="text-[10px] text-slate-400 font-mono">Bal: ${balanceAfter}</div>
      </div>
    </div>
  );
};
