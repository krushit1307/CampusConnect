// =============================================================================
// Route: Event Refund Choice Page
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// Description: Dedicated page where attendees of cancelled events can review
// cancellation notices and select their refund option (10% Bonus Credit vs Card).
// =============================================================================

import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePlatformCredit } from "../hooks/usePlatformCredit";
import { EventCancellationRefundChoiceModal } from "../components/events/EventCancellationRefundChoiceModal";
import { PlatformCreditLedgerWidget } from "../components/wallet/PlatformCreditLedgerWidget";
import type { CancellationRefundClaim } from "../types/platformCredit";

export default function EventRefundChoicePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const claimIdParam = searchParams.get("claim_id");
  const eventIdParam = searchParams.get("event_id");

  const { pendingClaims, isLoading, resolveClaim } = usePlatformCredit();
  const [selectedClaim, setSelectedClaim] = useState<CancellationRefundClaim | null>(null);

  useEffect(() => {
    if (pendingClaims.length > 0) {
      if (claimIdParam) {
        const found = pendingClaims.find((c) => c.id === claimIdParam);
        if (found) setSelectedClaim(found);
      } else if (eventIdParam) {
        const found = pendingClaims.find((c) => c.event_id === eventIdParam);
        if (found) setSelectedClaim(found);
      } else if (!selectedClaim) {
        setSelectedClaim(pendingClaims[0]);
      }
    }
  }, [pendingClaims, claimIdParam, eventIdParam]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate("/events")}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-4"
          >
            &larr; Back to Events
          </button>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Event Cancellation & Refund Options
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose how you'd like to receive refunds for cancelled events. Select Platform Credit for an instant +10% bonus.
          </p>
        </div>

        {/* Pending Claims Section */}
        {isLoading ? (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse">
            <div className="h-6 bg-slate-800 rounded w-1/3 mb-4"></div>
            <div className="h-20 bg-slate-800 rounded"></div>
          </div>
        ) : pendingClaims.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <span>⚠️</span> Action Required: Select Refund Method
            </h2>

            <div className="grid gap-4">
              {pendingClaims.map((claim) => {
                const orig = (claim.original_amount_cents / 100).toFixed(2);
                const cred = (claim.credit_amount_cents / 100).toFixed(2);
                return (
                  <div
                    key={claim.id}
                    className="p-5 bg-slate-900 border-2 border-indigo-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:flex-row justify-between gap-4 shadow-xl"
                  >
                    <div>
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-300 text-[10px] font-bold uppercase tracking-wider rounded-md border border-red-500/30">
                        Event Cancelled
                      </span>
                      <h3 className="text-lg font-black text-white mt-1">
                        {claim.event_title || "Campus Event"}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1">
                        Ticket Amount: <strong className="text-white">${orig}</strong> &bull; Bonus Credit:{" "}
                        <strong className="text-emerald-400">${cred} (+10%)</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedClaim(claim)}
                      className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition shrink-0"
                    >
                      Choose Refund
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-2">
            <p className="text-sm font-semibold text-slate-300">
              No pending cancellation refunds.
            </p>
            <p className="text-xs text-slate-500">
              All your refunds and credits have already been processed and credited to your wallet.
            </p>
          </div>
        )}

        {/* Platform Balance & Ledger Widget */}
        <div className="pt-4">
          <PlatformCreditLedgerWidget />
        </div>
      </div>

      {/* Refund Modal */}
      {selectedClaim && (
        <EventCancellationRefundChoiceModal
          claim={selectedClaim}
          isOpen={true}
          onClose={() => setSelectedClaim(null)}
          onSelectChoice={resolveClaim}
          onSuccess={() => setSelectedClaim(null)}
        />
      )}
    </div>
  );
}
