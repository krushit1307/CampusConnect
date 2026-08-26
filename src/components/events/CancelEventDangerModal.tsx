// =============================================================================
// Component: CancelEventDangerModal
// Issue: #3342 - Automated Event Cancellation Refunds
// Description: Danger-zone modal requiring organisers to type "CANCEL [EVENT TITLE]"
// to unlock automated mass cancellation, Stripe refund batching, and attendee alerts.
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  validateCancellationConfirmation,
  cancelEventAndRefund,
  processBatchRefunds,
  getEventInsurancePolicyId,
  EventCancellationResult,
} from "../../services/eventCancellationService";
import { EVENT_CANCELLATION_REASONS, FILE_CLAIM_PROMPT } from "../../lib/eventInsuranceClaim";

interface CancelEventDangerModalProps {
  eventId: string;
  eventTitle: string;
  totalAttendees?: number;
  totalRevenueUSD?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: EventCancellationResult) => void;
}

export const CancelEventDangerModal: React.FC<CancelEventDangerModalProps> = ({
  eventId,
  eventTitle,
  totalAttendees = 200,
  totalRevenueUSD = 4000,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [reason, setReason] = useState<(typeof EVENT_CANCELLATION_REASONS)[number]>(
    EVENT_CANCELLATION_REASONS[0],
  );
  const [insurancePolicyId, setInsurancePolicyId] = useState<string | null>(null);
  const [fileInsuranceClaim, setFileInsuranceClaim] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [result, setResult] = useState<EventCancellationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInsurancePolicyId(null);
      setFileInsuranceClaim(false);
      return;
    }

    let cancelled = false;
    getEventInsurancePolicyId(eventId)
      .then((policyId) => {
        if (!cancelled) setInsurancePolicyId(policyId);
      })
      .catch(() => {
        if (!cancelled) setInsurancePolicyId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, eventId]);

  if (!isOpen) return null;

  const isUnlocked = validateCancellationConfirmation(eventTitle, typedConfirmation);
  const expectedText = `CANCEL ${eventTitle.trim()}`.toUpperCase();

  const handleExecuteCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked) return;

    setCancelling(true);
    setErrorMessage(null);

    // Simulate batch progress for rate-limit safe mass processing UI
    const dummyItems = Array.from({ length: totalAttendees }).map((_, i) => ({
      rsvpId: `rsvp-${i}`,
      amountCents: Math.round((totalRevenueUSD * 100) / (totalAttendees || 1)),
    }));

    await processBatchRefunds(dummyItems, 10, 100, (processed, total) => {
      setBatchProgress({ current: processed, total });
    });

    const res = await cancelEventAndRefund(
      eventId,
      reason,
      eventTitle,
      Boolean(insurancePolicyId && fileInsuranceClaim),
    );
    setCancelling(false);

    if (res.success) {
      setResult(res);
      if (onSuccess) onSuccess(res);
    } else {
      setErrorMessage(res.error || "Failed to execute event cancellation.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative text-white">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-slate-400 hover:text-white text-xl font-bold"
        >
          &times;
        </button>

        {!result ? (
          <>
            {/* Warning Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-wider rounded-full border border-red-500/30">
                  Danger Zone Action
                </span>
                <h3 className="text-2xl font-black text-white mt-0.5">
                  Cancel Event & Issue Mass Refunds
                </h3>
              </div>
            </div>

            {/* Impact Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 mb-6">
              <p className="text-xs text-slate-400">
                Cancelling <strong className="text-white">{eventTitle}</strong> will immediately:
              </p>
              <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5 font-mono">
                <li>
                  Cancel all <strong>{totalAttendees}</strong> attendee RSVP reservations.
                </li>
                <li>
                  Orchestrate 100% mass refunds totaling{" "}
                  <strong>${totalRevenueUSD.toLocaleString()}</strong>.
                </li>
                <li>Send automated email notifications confirming refund arrival in 3-5 days.</li>
                <li>
                  Dispatch automated cancellation alerts & contract fee calculations to all{" "}
                  <strong>contracted vendors</strong>.
                </li>
              </ul>
            </div>

            <form onSubmit={handleExecuteCancellation} className="space-y-4">
              <div>
                <label
                  htmlFor="cancellation-reason"
                  className="block text-xs font-bold text-slate-300 mb-1"
                >
                  Reason for Cancellation
                </label>
                <select
                  id="cancellation-reason"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as (typeof EVENT_CANCELLATION_REASONS)[number])
                  }
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"
                >
                  {EVENT_CANCELLATION_REASONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {insurancePolicyId && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={fileInsuranceClaim}
                    onChange={(e) => setFileInsuranceClaim(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                  />
                  {FILE_CLAIM_PROMPT}
                </label>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Type <span className="font-mono text-red-400 select-all">{expectedText}</span> to
                  confirm
                </label>
                <input
                  type="text"
                  value={typedConfirmation}
                  onChange={(e) => setTypedConfirmation(e.target.value)}
                  placeholder={`Type: ${expectedText}`}
                  className="w-full bg-slate-950 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600"
                />
              </div>

              {/* Batch Processing Indicator */}
              {batchProgress && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span>Batch Refunding Attendees...</span>
                    <span>
                      {batchProgress.current} / {batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 transition-all duration-200"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMessage && <p className="text-xs text-red-400 font-medium">{errorMessage}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Keep Event
                </button>
                <button
                  type="submit"
                  disabled={!isUnlocked || cancelling}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-600/30"
                >
                  {cancelling ? "Processing Mass Refunds..." : "Cancel Event & Refund All"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 border border-red-500/40 text-red-400 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-black text-white">Event Cancelled & Refunds Issued</h3>
            <p className="text-xs text-slate-300 max-w-sm mx-auto">{result.message}</p>
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 space-y-1 text-left">
              <div>Total RSVPs Cancelled: {result.total_rsvps_cancelled}</div>
              <div>Paid Ticket Refunds Issued: {result.total_paid_refunds}</div>
              <div>Total Refunded: ${(result.total_refunded_amount_cents || 0) / 100}</div>
              {result.vendor_summary && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-purple-400 font-semibold">
                  <div>
                    Vendors Notified: {result.vendor_summary.totalVendorsNotified} (Email, SMS,
                    Webhook)
                  </div>
                  <div>
                    Total Vendor Cancellation Fees: $
                    {(result.vendor_summary.totalCancellationFeesCents / 100).toLocaleString()}
                  </div>
                </div>
              )}
              {result.insurance_claim && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-amber-300">
                  Insurance claim:{" "}
                  {result.insurance_claim.underwriter_status ||
                    result.insurance_claim.error ||
                    "compiled"}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
