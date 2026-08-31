import React, { useMemo, useState } from "react";
import { AlertTriangle, Lock, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TIER_TEXT_CLASS,
  bookingsToFundReplacement,
  formatUsd,
  quotePremium,
} from "@/lib/hardwareInsurancePremium";
import { InsurableAsset, PremiumQuote } from "@/types/hardwareInsurance";

/**
 * Mandatory micro-premium step in the hardware checkout (#5289).
 *
 * The premium is priced from the asset's replacement value and its category risk
 * tier, shown with the arithmetic behind it, and cannot be skipped: the confirm
 * button stays disabled until the club acknowledges the charge is non-refundable.
 * Hiding a non-refundable debit behind a single "Book" click is how a club
 * discovers it after the fact and disputes it.
 */

export interface HardwareInsurancePremiumCheckoutProps {
  asset: InsurableAsset;
  clubId: string;
  clubName?: string;
  bookingHours?: number;
  /** Club's available Stripe escrow balance, used to block an unfundable booking. */
  escrowBalanceUsd: number;
  /** Charges the premium and confirms the booking. */
  onConfirm?: (quote: PremiumQuote) => Promise<void> | void;
}

export const HardwareInsurancePremiumCheckout: React.FC<HardwareInsurancePremiumCheckoutProps> = ({
  asset,
  clubId,
  clubName = "your club",
  bookingHours = 24,
  escrowBalanceUsd,
  onConfirm,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const quote = useMemo(() => quotePremium(asset, bookingHours), [asset, bookingHours]);
  const bookingsPerReplacement = useMemo(() => bookingsToFundReplacement(asset), [asset]);

  const escrowShortfall = quote.premiumUsd > escrowBalanceUsd;
  const canConfirm = acknowledged && !escrowShortfall && !isCharging && !confirmed;

  const handleConfirm = async () => {
    if (!canConfirm) return;

    setIsCharging(true);
    setError("");
    try {
      // POST /functions/v1/hardware-insurance-settlement { action: "charge_premium" }
      // debits the escrow and credits the pool; it re-prices server-side, so the
      // figure below is a quote rather than the authority on what is charged.
      await onConfirm?.(quote);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not charge the premium.");
    } finally {
      setIsCharging(false);
    }
  };

  return (
    <Card
      className="bg-slate-900 border-slate-800 max-w-2xl"
      data-testid="hardware-insurance-checkout"
    >
      <CardHeader className="border-b border-slate-800 pb-5">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Damage protection premium
        </CardTitle>
        <CardDescription className="text-slate-400">
          Required to check out {asset.name}. Funds the university hardware replacement pool.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-5">
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Non-refundable premium
          </p>
          <p className="mt-2 text-4xl font-black text-white" data-testid="premium-amount">
            {formatUsd(quote.premiumUsd)}
          </p>
          <p
            className={`mt-2 text-xs font-bold uppercase tracking-widest ${TIER_TEXT_CLASS[quote.tier]}`}
          >
            {quote.tier} risk · ×{quote.riskMultiplier}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-widest text-slate-500">Replacement value</dt>
            <dd className="mt-1 font-mono text-slate-100">{formatUsd(quote.valuationUsd)}</dd>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-widest text-slate-500">Booking length</dt>
            <dd className="mt-1 font-mono text-slate-100">
              {quote.bookingHours}h · ×{quote.durationFactor}
            </dd>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-widest text-slate-500">Escrow balance</dt>
            <dd className="mt-1 font-mono text-slate-100">{formatUsd(escrowBalanceUsd)}</dd>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <dt className="text-xs uppercase tracking-widest text-slate-500">
              Bookings per replacement
            </dt>
            <dd className="mt-1 font-mono text-slate-100">{bookingsPerReplacement}</dd>
          </div>
        </dl>

        <p className="font-mono text-xs text-slate-500">{quote.explanation}</p>

        {escrowShortfall && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
            <Wallet className="h-4 w-4 mt-0.5 shrink-0" />
            {clubName} has {formatUsd(escrowBalanceUsd)} in escrow, short of the{" "}
            {formatUsd(quote.premiumUsd)} premium. Top up the escrow to book this asset.
          </p>
        )}

        <label className="flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            aria-label="Acknowledge the non-refundable premium"
            className="mt-1"
          />
          <span>
            I understand {formatUsd(quote.premiumUsd)} will be debited from {clubName}&apos;s Stripe
            escrow and is <strong>not refunded</strong> when the asset is returned undamaged.
          </span>
        </label>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {confirmed ? (
          <p role="status" className="flex items-start gap-2 text-sm text-emerald-400">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
            {formatUsd(quote.premiumUsd)} moved from escrow into the hardware replacement pool.
            Checkout of {asset.name} is covered.
          </p>
        ) : (
          <Button onClick={handleConfirm} disabled={!canConfirm} data-club-id={clubId}>
            <Lock className="h-4 w-4 mr-2" />
            {isCharging ? "Charging escrow…" : `Pay ${formatUsd(quote.premiumUsd)} & check out`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default HardwareInsurancePremiumCheckout;
