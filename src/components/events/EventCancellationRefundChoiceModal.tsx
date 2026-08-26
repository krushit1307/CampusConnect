// =============================================================================
// Component: EventCancellationRefundChoiceModal
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Allows attendees of cancelled events to choose their refund method:
// 1) Full Refund to Card ($50.00)
// 2) $55.00 in CampusConnect Credit (10% Bonus - Recommended)
// =============================================================================

import React, { useState } from "react";
import type { CancellationRefundClaim, RefundChoiceResult, RefundOptionChoice } from "../../types/platformCredit";
import { calculateCancellationCredit } from "../../services/platformCreditService";

interface EventCancellationRefundChoiceModalProps {
  claim: CancellationRefundClaim;
  isOpen: boolean;
  onClose: () => void;
  onSelectChoice: (claimId: string, choice: RefundOptionChoice) => Promise<RefundChoiceResult>;
  onSuccess?: (result: RefundChoiceResult) => void;
}

export const EventCancellationRefundChoiceModal: React.FC<EventCancellationRefundChoiceModalProps> = ({
  claim,
  isOpen,
  onClose,
  onSelectChoice,
  onSuccess,
}) => {
  const [selectedOption, setSelectedOption] = useState<RefundOptionChoice>("credit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RefundChoiceResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const originalDollars = (claim.original_amount_cents / 100).toFixed(2);
  const { bonusAmountCents, creditAmountCents } = calculateCancellationCredit(
    claim.original_amount_cents,
    claim.bonus_percentage || 10,
  );
  const bonusDollars = (bonusAmountCents / 100).toFixed(2);
  const creditDollars = (creditAmountCents / 100).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await onSelectChoice(claim.id, selectedOption);
      if (res.success) {
        setResult(res);
        if (onSuccess) onSuccess(res);
      } else {
        setErrorMessage(res.error || "Failed to process your refund choice.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold transition"
        >
          &times;
        </button>

        {!result ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-full border border-amber-500/30">
                  Event Cancelled
                </span>
                <h3 id="refund-modal-title" className="text-xl font-black text-white mt-0.5">
                  Choose Your Refund
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              The event <strong className="text-white">"{claim.event_title || "Campus Event"}"</strong> was cancelled.
              Please choose how you would like to receive your refund:
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Option 2: Platform Credit (Recommended) */}
              <label
                className={`flex items-start p-4 rounded-2xl border-2 cursor-pointer transition relative overflow-hidden ${
                  selectedOption === "credit"
                    ? "bg-indigo-950/70 border-indigo-500 shadow-lg shadow-indigo-500/20"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="refund_choice"
                  value="credit"
                  checked={selectedOption === "credit"}
                  onChange={() => setSelectedOption("credit")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      ${creditDollars} in CampusConnect Credit
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase rounded-full border border-emerald-500/30">
                      +{claim.bonus_percentage}% Bonus
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Receive your full <strong>${originalDollars}</strong> plus a{" "}
                    <strong className="text-emerald-400">+${bonusDollars}</strong> bonus credited immediately to your platform balance.
                  </p>
                  <ul className="text-[11px] text-slate-400 mt-2 space-y-0.5 list-disc pl-4">
                    <li>Available instantly in your wallet</li>
                    <li>Auto-deducted during future checkouts</li>
                    <li>Never expires</li>
                  </ul>
                </div>
              </label>

              {/* Option 1: Card Refund */}
              <label
                className={`flex items-start p-4 rounded-2xl border-2 cursor-pointer transition ${
                  selectedOption === "card"
                    ? "bg-slate-800/80 border-slate-400 shadow-md"
                    : "bg-slate-950 border-slate-800 hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="refund_choice"
                  value="card"
                  checked={selectedOption === "card"}
                  onChange={() => setSelectedOption("card")}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="ml-3 flex-1">
                  <div className="font-bold text-white text-sm">
                    Full Refund to Card (${originalDollars})
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    100% refund credited back to your original payment card via Stripe.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Processing typically takes 3-5 business days depending on your bank.
                  </p>
                </div>
              </label>

              {errorMessage && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-300">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Decide Later
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-lg shadow-indigo-600/30"
                >
                  {isSubmitting
                    ? "Processing..."
                    : selectedOption === "credit"
                    ? `Claim $${creditDollars} Credit (+10%)`
                    : `Refund $${originalDollars} to Card`}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Confirmation Success State */
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-white">
              {result.choice === "credit" ? "Platform Credit Issued!" : "Card Refund Initiated"}
            </h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              {result.message ||
                (result.choice === "credit"
                  ? `Your $${creditDollars} platform credit has been added and will auto-apply to your next checkout.`
                  : `Your refund of $${originalDollars} has been initiated back to your card.`)}
            </p>
            {result.choice === "credit" && result.new_balance_cents !== undefined && (
              <div className="p-4 bg-slate-950 rounded-2xl border border-indigo-500/30 text-xs font-mono text-slate-300 space-y-1">
                <div className="text-indigo-400 font-bold">New Platform Balance:</div>
                <div className="text-2xl font-black text-white">
                  ${(result.new_balance_cents / 100).toFixed(2)}
                </div>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
