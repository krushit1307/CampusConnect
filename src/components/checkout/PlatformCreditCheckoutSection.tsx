// =============================================================================
// Component: PlatformCreditCheckoutSection
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Displays user platform credit balance in checkout and automatically
// applies deductions before hitting the credit card.
// =============================================================================

import React from "react";
import { usePlatformCredit } from "../../hooks/usePlatformCredit";

interface PlatformCreditCheckoutSectionProps {
  orderTotalCents: number;
  customBalanceCents?: number;
  className?: string;
}

export const PlatformCreditCheckoutSection: React.FC<PlatformCreditCheckoutSectionProps> = ({
  orderTotalCents,
  customBalanceCents,
  className = "",
}) => {
  const { balance, isLoading } = usePlatformCredit();

  const balanceCents =
    customBalanceCents !== undefined
      ? customBalanceCents
      : balance?.balance_cents || 0;

  if (isLoading && customBalanceCents === undefined) {
    return (
      <div className={`p-4 bg-slate-900 border border-slate-800 rounded-xl animate-pulse ${className}`}>
        <div className="h-4 bg-slate-800 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-slate-800 rounded w-full"></div>
      </div>
    );
  }

  const creditToApplyCents = Math.min(balanceCents, orderTotalCents);
  const remainingDueCents = Math.max(0, orderTotalCents - creditToApplyCents);
  const isFullyCovered = creditToApplyCents >= orderTotalCents && orderTotalCents > 0;

  const totalDollars = (orderTotalCents / 100).toFixed(2);
  const balanceDollars = (balanceCents / 100).toFixed(2);
  const creditAppliedDollars = (creditToApplyCents / 100).toFixed(2);
  const remainingDueDollars = (remainingDueCents / 100).toFixed(2);

  return (
    <div
      className={`p-4 rounded-2xl border ${
        isFullyCovered
          ? "bg-emerald-950/40 border-emerald-500/40"
          : creditToApplyCents > 0
          ? "bg-indigo-950/40 border-indigo-500/40"
          : "bg-slate-900 border-slate-800"
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg ${
              isFullyCovered
                ? "bg-emerald-500/20 text-emerald-400"
                : creditToApplyCents > 0
                ? "bg-indigo-500/20 text-indigo-400"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">CampusConnect Platform Credit</h4>
            <p className="text-[10px] text-slate-400">Available: ${balanceDollars}</p>
          </div>
        </div>

        {creditToApplyCents > 0 && (
          <span
            className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${
              isFullyCovered
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
            }`}
          >
            {isFullyCovered ? "100% Covered" : "Auto-Applied"}
          </span>
        )}
      </div>

      {creditToApplyCents > 0 ? (
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs font-mono">
          <div className="flex justify-between text-slate-300">
            <span>Order Subtotal:</span>
            <span>${totalDollars}</span>
          </div>
          <div className="flex justify-between text-emerald-400 font-bold">
            <span>Platform Credit Applied:</span>
            <span>-${creditAppliedDollars}</span>
          </div>
          <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800 text-sm">
            <span>Remaining Due (Card):</span>
            <span>${remainingDueDollars}</span>
          </div>

          {isFullyCovered ? (
            <p className="text-[11px] font-sans text-emerald-300 font-semibold pt-1">
              ✨ No credit card required! This checkout will be fully paid with your platform credit.
            </p>
          ) : (
            <p className="text-[11px] font-sans text-slate-400 pt-1">
              ${creditAppliedDollars} deducted from your balance. The remaining ${remainingDueDollars} will be charged to your card.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          No platform credit available. Checkouts will be charged directly to your card.
        </p>
      )}
    </div>
  );
};
