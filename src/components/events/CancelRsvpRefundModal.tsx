// =============================================================================
// Component: CancelRsvpRefundModal
// Issue: #3688 - Implement 'Automated "Refund/Cancellation" Fee Calculator'
// Description: Confirmation modal displaying time-decay prorated refund policy calculation
// before allowing users to confirm ticket cancellation.
// =============================================================================

import React, { useState } from "react";
import {
  calculateProratedRefund,
  processPaidRsvpCancellation,
  type DEFAULT_REFUND_POLICY,
} from "@/services/refundCalculatorService";
import type { RefundPolicy } from "@/types/database";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Clock from "lucide-react/dist/esm/icons/clock";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import X from "lucide-react/dist/esm/icons/x";

interface CancelRsvpRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  rsvpId: string;
  eventId: string;
  userId: string;
  eventTitle: string;
  eventStartTime: string | Date;
  ticketPriceDollars?: number;
  refundPolicy?: RefundPolicy;
  onCancellationComplete?: () => void;
}

export function CancelRsvpRefundModal({
  isOpen,
  onClose,
  rsvpId,
  eventId,
  userId,
  eventTitle,
  eventStartTime,
  ticketPriceDollars = 100,
  refundPolicy,
  onCancellationComplete,
}: CancelRsvpRefundModalProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculation = calculateProratedRefund(eventStartTime, ticketPriceDollars, refundPolicy);

  const handleConfirmCancellation = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await processPaidRsvpCancellation(
      rsvpId,
      eventId,
      userId,
      ticketPriceDollars,
      eventStartTime,
    );

    setIsSubmitting(false);

    if (res.success) {
      if (onCancellationComplete) onCancellationComplete();
      onClose();
    } else {
      setErrorMessage(res.error || "Failed to process ticket cancellation.");
    }
  };

  return (
    <div
      data-testid="cancel-rsvp-refund-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/50 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Cancel Ticket & Refund Policy</h3>
            <p className="text-xs text-slate-400">{eventTitle}</p>
          </div>
        </div>

        {/* TIME-DECAY CALCULATION WARNING BANNER */}
        <div
          data-testid="refund-policy-warning-banner"
          className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 my-4 text-amber-200 text-sm leading-relaxed"
        >
          <p className="font-bold text-amber-300">
            You are cancelling {calculation.hours_before_event} hours before the event. Per the
            policy, you will receive a{" "}
            <span className="underline decoration-amber-400 font-extrabold">
              {calculation.refund_percentage}% refund
            </span>{" "}
            ($
            {calculation.refund_amount_dollars}). Proceed?
          </p>
        </div>

        {/* BREAKDOWN CARDS */}
        <div className="grid grid-cols-2 gap-3 my-4 font-mono text-xs">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Prorated Refund</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">
              ${calculation.refund_amount_dollars}
            </p>
            <p className="text-[10px] text-slate-500">
              {calculation.refund_percentage}% of original ticket
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Cancellation Fee</span>
            </div>
            <p className="text-lg font-bold text-red-400">
              ${calculation.cancellation_fee_dollars}
            </p>
            <p className="text-[10px] text-slate-500">Covers sunk catering costs</p>
          </div>
        </div>

        {/* TIME-DECAY POLICY RULES */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2 mb-6">
          <p className="font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> Event Refund Policy
          </p>
          <ul className="space-y-1 text-slate-400 font-mono text-[11px]">
            <li
              className={calculation.hours_before_event >= 168 ? "text-emerald-300 font-bold" : ""}
            >
              • &gt; 7 days (168h): 100% Refund ($100)
            </li>
            <li
              className={
                calculation.hours_before_event < 168 && calculation.hours_before_event >= 48
                  ? "text-amber-300 font-bold"
                  : ""
              }
            >
              • &gt; 48 hours: 50% Refund ($50)
            </li>
            <li className={calculation.hours_before_event < 48 ? "text-red-400 font-bold" : ""}>
              • &lt; 48 hours: 0% Refund ($0)
            </li>
          </ul>
        </div>

        {errorMessage && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-3 rounded-xl mb-4">
            {errorMessage}
          </p>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm rounded-xl transition-colors"
          >
            Keep My Ticket
          </button>

          <button
            type="button"
            onClick={handleConfirmCancellation}
            disabled={isSubmitting}
            data-testid="confirm-cancel-rsvp-btn"
            className="w-full sm:w-1/2 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting
              ? "Processing..."
              : `Confirm Cancellation ($${calculation.refund_amount_dollars} Refund)`}
          </button>
        </div>
      </div>
    </div>
  );
}
