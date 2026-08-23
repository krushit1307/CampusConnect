// =============================================================================
// File: src/components/pricing/PublicFlashSaleBannerOverlay.tsx
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Public student-facing Event Page overlay with pulsing countdown timer,
//              discount sticker badges, inventory scarcity bar, and 1-click checkout.
// =============================================================================

import React, { useState, useEffect } from "react";
import {
  Zap,
  Clock,
  Flame,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FlashSaleCampaign } from "@/types/dynamicPricingFlashSale";
import {
  calculateTimeRemaining,
  CountdownTimeRemaining,
} from "@/services/flashSaleCountdownWorker";

interface PublicFlashSaleBannerOverlayProps {
  campaign: FlashSaleCampaign;
  onCheckoutClick?: (campaign: FlashSaleCampaign) => void;
}

export const PublicFlashSaleBannerOverlay: React.FC<PublicFlashSaleBannerOverlayProps> = ({
  campaign,
  onCheckoutClick,
}) => {
  const [timeLeft, setTimeLeft] = useState<CountdownTimeRemaining>(
    calculateTimeRemaining(campaign.expiresAt)
  );

  // High-frequency tick (100ms for smooth millisecond display)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(campaign.expiresAt));
    }, 100);

    return () => clearInterval(timer);
  }, [campaign.expiresAt]);

  const remainingTickets = Math.max(
    0,
    campaign.totalFlashSaleTicketsCap - campaign.ticketsSoldDuringSale
  );
  const percentSold = Math.min(
    100,
    Math.round((campaign.ticketsSoldDuringSale / campaign.totalFlashSaleTicketsCap) * 100)
  );

  if (timeLeft.isExpired || campaign.status !== "active") {
    return null;
  }

  return (
    <div className="neu-border relative overflow-hidden bg-black p-6 text-white shadow-[6px_6px_0_0_#000] dark:bg-zinc-950 border-2 border-lime">
      {/* Background Neon Glow */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-lime/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Headline & Scarcity */}
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded bg-lime px-2.5 py-1 font-mono text-[10px] font-black uppercase text-black">
            <Flame className="h-3.5 w-3.5 text-rose-600 animate-bounce" />
            <span>Limited-Time Flash Sale ({campaign.discountPercentage}% OFF)</span>
          </div>

          <h3 className="text-2xl font-black uppercase tracking-tight text-white">
            {campaign.customMarketingHeadline ||
              `Special Discount on ${campaign.ticketTierName}!`}
          </h3>

          <p className="font-mono text-xs text-zinc-300">
            Secure your spot before prices revert. Only{" "}
            <strong className="text-lime">{remainingTickets} tickets remaining</strong> at this
            discounted rate.
          </p>

          {/* Scarcity Progress Meter */}
          <div className="pt-2 max-w-md font-mono text-xs">
            <div className="flex justify-between text-[10px] text-zinc-400 font-bold mb-1">
              <span>Claimed: {percentSold}%</span>
              <span className="text-lime">{remainingTickets} left</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
              <div
                className="h-full bg-gradient-to-r from-lime to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${percentSold}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Massive Countdown Timer & Price Box */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/90 p-4 rounded border border-zinc-800">
          {/* Pulsing Countdown Clock */}
          <div className="text-center">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-400 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3 text-lime animate-spin" /> Sale Ends In
            </span>
            <div className="mt-1 font-mono text-3xl font-black tracking-widest text-lime drop-shadow-[0_0_8px_rgba(204,253,80,0.5)]">
              {timeLeft.formattedString}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              .{timeLeft.milliseconds.toString().padStart(2, "0")} ms
            </span>
          </div>

          {/* Pricing Details */}
          <div className="border-t sm:border-t-0 sm:border-l border-zinc-700 pt-3 sm:pt-0 sm:pl-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-500 line-through">
                ${campaign.originalPriceUsd}
              </span>
              <span className="font-mono text-2xl font-black text-white">
                ${campaign.discountedPriceUsd}
              </span>
            </div>

            <Button
              onClick={() => onCheckoutClick?.(campaign)}
              className="neu-border mt-2 w-full bg-lime font-mono text-xs font-black uppercase text-black hover:bg-lime/80 shadow-[3px_3px_0_0_#fff]"
            >
              <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Claim Discount Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicFlashSaleBannerOverlay;
