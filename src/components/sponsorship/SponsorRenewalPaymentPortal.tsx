/**
 * Sponsor-Facing Renewal Payment Portal Modal
 * Issue #4141
 * Direct payment interface accessible via email link to pay Stripe renewal invoice
 * and preserve active banner logo status.
 */

import React, { useState } from 'react';
import { SponsorshipTierRenewal } from '../../types/sponsorshipRenewal';
import {
  CreditCard,
  CheckCircle2,
  Shield,
  Building,
  Calendar,
  Lock,
  ArrowRight,
} from 'lucide-react';

interface SponsorRenewalPaymentPortalProps {
  sponsorship: SponsorshipTierRenewal;
  onConfirmPayment: () => Promise<void>;
  onClose?: () => void;
}

export const SponsorRenewalPaymentPortal: React.FC<
  SponsorRenewalPaymentPortalProps
> = ({ sponsorship, onConfirmPayment, onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      await onConfirmPayment();
      setIsPaid(true);
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 max-w-lg mx-auto rounded-3xl p-6 shadow-2xl text-slate-100 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base">
              Annual Sponsorship Renewal
            </h3>
            <p className="text-xs text-slate-400">
              CampusConnect Verified Club Partner Billing
            </p>
          </div>
        </div>

        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono font-semibold rounded-xl">
          {sponsorship.tier_name} Tier
        </span>
      </div>

      {isPaid ? (
        <div className="py-8 text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto animate-bounce" />
          <h4 className="font-bold text-lg text-emerald-300">
            Sponsorship Renewed Successfully!
          </h4>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Your {sponsorship.tier_name} tier placement is extended for 365 days.
            Your logo is active in the Club Sponsor Rotator.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
            >
              Return to Portal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Invoice Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Organization:</span>
              <span className="font-semibold text-slate-200">{sponsorship.sponsor_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Recipient Club:</span>
              <span className="font-semibold text-slate-200">{sponsorship.club_name || 'Campus Club'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Billing Term:</span>
              <span>12 Months (Auto-Renewable)</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-700 text-sm font-bold text-emerald-400">
              <span>Total Invoice Amount:</span>
              <span>${sponsorship.annual_amount_usd}.00 USD</span>
            </div>
          </div>

          {/* Secure Payment Details */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-semibold">Payment Method</span>
              <span className="flex items-center space-x-1 text-slate-500 font-mono text-[11px]">
                <Lock className="w-3 h-3" />
                <span>256-Bit SSL Encrypted</span>
              </span>
            </div>

            <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-between font-mono text-slate-300">
              <span>•••• •••• •••• 4242</span>
              <span className="text-slate-500">12/28</span>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={isProcessing}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
          >
            <span>{isProcessing ? 'Processing via Stripe...' : `Pay $${sponsorship.annual_amount_usd}.00 & Maintain Logo`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
