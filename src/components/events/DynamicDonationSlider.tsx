import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Sparkles,
  Gift,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import {
  getMatchedDonationTier,
  validateDonationAmount,
  DEFAULT_DONATION_TIERS,
  type DonationTier,
} from "@/services/donationSliderService";

interface DynamicDonationSliderProps {
  minPrice?: number;
  maxPrice?: number;
  defaultPrice?: number;
  tiers?: DonationTier[];
  eventTitle?: string;
  onProceedToCheckout?: (amount: number) => Promise<void> | void;
  isProcessing?: boolean;
}

export const DynamicDonationSlider: React.FC<DynamicDonationSliderProps> = ({
  minPrice = 10,
  maxPrice = 1000,
  defaultPrice = 50,
  tiers = DEFAULT_DONATION_TIERS,
  eventTitle = "Charity Event",
  onProceedToCheckout,
  isProcessing = false,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(Math.max(defaultPrice, minPrice));

  const matchedTier = getMatchedDonationTier(selectedAmount, tiers);
  const validation = validateDonationAmount(selectedAmount, minPrice, maxPrice);

  const presetAmounts = [minPrice, 25, 50, 100, 250, 500].filter(
    (a) => a >= minPrice && a <= maxPrice,
  );

  const handleSliderChange = (vals: number[]) => {
    if (vals.length > 0) {
      setSelectedAmount(vals[0]);
    }
  };

  const handleCheckout = () => {
    if (validation.isValid && onProceedToCheckout) {
      onProceedToCheckout(validation.integerAmount);
    }
  };

  return (
    <div className="rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
            <Heart className="h-6 w-6 fill-emerald-500/20" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-100">Choose Your Ticket & Impact</h3>
            <p className="text-xs text-slate-400">
              Support {eventTitle} with a custom suggested donation amount.
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
            Min ${minPrice}
          </span>
        </div>
      </div>

      {/* Dynamic Counter Display */}
      <div className="text-center py-4 bg-slate-900/80 rounded-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Your Ticket / Donation Amount
        </div>
        <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 tracking-tight">
          ${selectedAmount}
        </div>

        {/* Dynamic Impact Animation Badge */}
        {matchedTier && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold animate-pulse">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Impact: {matchedTier.impact}</span>
          </div>
        )}
      </div>

      {/* Interactive Slider */}
      <div className="space-y-3 px-2">
        <Slider
          value={[selectedAmount]}
          onValueChange={handleSliderChange}
          min={minPrice}
          max={maxPrice}
          step={5}
          className="cursor-pointer py-4"
        />

        <div className="flex justify-between text-xs font-semibold text-slate-400">
          <span>${minPrice} (Base Entry)</span>
          <span>${Math.round((maxPrice + minPrice) / 2)}</span>
          <span>${maxPrice} (Philanthropist)</span>
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap items-center gap-2 justify-center pt-1">
        {presetAmounts.map((amt) => (
          <Button
            key={amt}
            type="button"
            variant="outline"
            onClick={() => setSelectedAmount(amt)}
            className={`text-xs font-bold px-3 py-1.5 h-8 rounded-lg border transition-all ${
              selectedAmount === amt
                ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
            }`}
          >
            ${amt}
          </Button>
        ))}
      </div>

      {/* Validation or Error Message */}
      {!validation.isValid && (
        <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-xl border border-rose-500/30 text-center font-medium">
          {validation.error}
        </div>
      )}

      {/* Checkout Action */}
      <div className="pt-2">
        <Button
          onClick={handleCheckout}
          disabled={!validation.isValid || isProcessing}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-6 text-sm rounded-xl shadow-xl shadow-emerald-500/20 gap-2 flex items-center justify-center"
        >
          <ShieldCheck className="h-5 w-5" />
          <span>
            {isProcessing
              ? "Preparing Stripe Checkout..."
              : `Proceed to Checkout ($${selectedAmount})`}
          </span>
        </Button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 mt-2">
          <span>Secure payments processed via Stripe. 100% goes to event organizers.</span>
        </div>
      </div>
    </div>
  );
};
