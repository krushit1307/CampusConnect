// =============================================================================
// File: src/components/pricing/InteractiveFlashSaleOrchestrator.tsx
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Interactive Flash Sale Orchestrator dashboard for event organizers,
//              Stripe dynamic price mutations, push notification triggers, and live velocity.
// =============================================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  Zap,
  Clock,
  Flame,
  DollarSign,
  TrendingUp,
  Percent,
  Radio,
  Send,
  AlertCircle,
  CheckCircle2,
  Download,
  Power,
  RotateCcw,
  Users,
  ShieldCheck,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Ticket,
  Lock,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  FlashSaleCampaign,
  TicketTierPricing,
  FlashSaleLiquidationMetrics,
  FlashSaleOrderPurchase,
  FlashSaleCreatePayload,
} from "@/types/dynamicPricingFlashSale";
import {
  getMockTicketTiers,
  getMockFlashSaleCampaigns,
  getMockFlashPurchases,
  calculateLiquidationMetrics,
  triggerFlashSaleCampaign,
  revertFlashSalePricing,
  exportFlashSaleAuditCSV,
} from "@/services/dynamicPricingFlashSaleService";
import {
  calculateTimeRemaining,
  CountdownTimeRemaining,
} from "@/services/flashSaleCountdownWorker";
import { PublicFlashSaleBannerOverlay } from "@/components/pricing/PublicFlashSaleBannerOverlay";
import { DynamicPricingElasticitySimulator } from "@/components/pricing/DynamicPricingElasticitySimulator";

interface InteractiveFlashSaleOrchestratorProps {
  eventId?: string;
  eventTitle?: string;
  initialTiers?: TicketTierPricing[];
}

export const InteractiveFlashSaleOrchestrator: React.FC<InteractiveFlashSaleOrchestratorProps> = ({
  eventId = "evt-gala-2026",
  eventTitle = "Annual Spring Charity Gala & Alumni Banquet",
  initialTiers,
}) => {
  const [tiers] = useState<TicketTierPricing[]>(initialTiers || getMockTicketTiers());
  const [campaigns, setCampaigns] = useState<FlashSaleCampaign[]>(getMockFlashSaleCampaigns());
  const [purchases, setPurchases] = useState<FlashSaleOrderPurchase[]>(getMockFlashPurchases());

  const [activeTab, setActiveTab] = useState<string>("active_sale");
  const [selectedTierId, setSelectedTierId] = useState<string>(tiers[0]?.id || "tier-gala-ga");
  const [discountPercent, setDiscountPercent] = useState<number>(50);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [ticketCap, setTicketCap] = useState<number>(50);
  const [targetAudience, setTargetAudience] = useState<FlashSaleCreatePayload["targetAudience"]>("waitlist_only");
  const [customHeadline, setCustomHeadline] = useState<string>("");
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [isReverting, setIsReverting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active Campaign
  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.status === "active") || campaigns[0];
  }, [campaigns]);

  // Selected Tier for New Campaign
  const selectedTier = useMemo(() => {
    return tiers.find((t) => t.id === selectedTierId) || tiers[0];
  }, [tiers, selectedTierId]);

  // Liquidation metrics
  const liquidationMetrics: FlashSaleLiquidationMetrics = useMemo(() => {
    return calculateLiquidationMetrics(activeCampaign, 24);
  }, [activeCampaign]);

  // Real-time Countdown Timer State
  const [timeLeft, setTimeLeft] = useState<CountdownTimeRemaining>(
    calculateTimeRemaining(activeCampaign.expiresAt)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(activeCampaign.expiresAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeCampaign.expiresAt]);

  // Handle 1-Click Flash Sale Trigger
  const handleLaunchFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTriggering(true);

    const payload: FlashSaleCreatePayload = {
      eventId,
      ticketTierId: selectedTierId,
      discountPercentage: discountPercent,
      durationMinutes,
      ticketCap,
      targetAudience,
      customHeadline,
    };

    const res = await triggerFlashSaleCampaign(payload, selectedTier);

    if (res.success && res.campaign) {
      setCampaigns((prev) => [res.campaign, ...prev.filter((c) => c.id !== res.campaign.id)]);
      setSuccessToast(
        `⚡ Flash Sale Activated! Stripe Price mutated to $${res.campaign.discountedPriceUsd} and push blast sent to ${res.campaign.marketingRecipientsCount} waitlisted students.`
      );
      setTimeout(() => setSuccessToast(null), 6000);
      setActiveTab("active_sale");
    }

    setIsTriggering(false);
  };

  // Handle 1-Click Rollback / Revert Price
  const handleRevertPrice = async () => {
    if (!activeCampaign) return;
    setIsReverting(true);

    await revertFlashSalePricing(activeCampaign.id);

    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === activeCampaign.id ? { ...c, status: "reverted", updatedAt: new Date().toISOString() } : c
      )
    );

    setSuccessToast(
      `Stripe Price ID reverted to standard $${activeCampaign.originalPriceUsd}. Flash sale concluded.`
    );
    setTimeout(() => setSuccessToast(null), 5000);
    setIsReverting(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Zap className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Real-Time Dynamic Pricing Flash Sale Engine
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              1-Click Stripe Price Mutations, Instant Waitlist Push Marketing Blasts & Automated Rollbacks • {eventTitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportFlashSaleAuditCSV(activeCampaign, liquidationMetrics, purchases)
              }
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              <Download className="h-3.5 w-3.5" />
              Export Financial Audit CSV
            </Button>
          </div>
        </div>

        {/* Global Success Notification */}
        {successToast && (
          <div className="neu-border mt-4 flex items-center gap-2 bg-emerald-100 p-3 text-xs font-mono font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* High-Level Liquidation KPI Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Realized Flash Revenue
            </span>
            <div className="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
              ${liquidationMetrics.realizedFlashRevenueUsd}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              ${activeCampaign.discountedPriceUsd} / ticket
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Inventory Liquidated
            </span>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {activeCampaign.ticketsSoldDuringSale} / {activeCampaign.totalFlashSaleTicketsCap}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {liquidationMetrics.conversionRatePercent}% conversion rate
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Liquidation Velocity
            </span>
            <div className="mt-1 font-mono text-xl font-black text-blue-600 dark:text-blue-400">
              {liquidationMetrics.liquidationVelocityPerMinute} tix/min
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Real-time checkout rate</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Demand Elasticity (ε)
            </span>
            <div className="mt-1 font-mono text-xl font-black text-purple-600 dark:text-purple-400">
              {liquidationMetrics.priceElasticityCoefficient}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">High elasticity responsiveness</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Auto-Revert Status
            </span>
            <div className="mt-1 font-mono text-xl font-black text-amber-600">
              {activeCampaign.status === "active" ? timeLeft.formattedString : "REVERTED"}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Scheduled rollback</span>
          </div>
        </div>
      </div>

      {/* Public Banner Preview */}
      <div>
        <h4 className="mb-2 font-mono text-xs font-black uppercase text-zinc-500">
          Live Public Attendee View (Embedded on Event Ticket Page)
        </h4>
        <PublicFlashSaleBannerOverlay campaign={activeCampaign} />
      </div>

      {/* Tabs Navigation: Active Sale Monitor vs 1-Click Launch Drawer vs Elasticity Simulator */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-xl grid-cols-3 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="active_sale"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Active Sale Monitor
          </TabsTrigger>
          <TabsTrigger
            value="launch_sale"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            1-Click Launch Sale
          </TabsTrigger>
          <TabsTrigger
            value="elasticity_modeler"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Elasticity Modeler
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Sale Monitor */}
        <TabsContent value="active_sale" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left: Active Campaign Details (7 cols) */}
            <div className="space-y-4 lg:col-span-7">
              <div className="neu-border bg-white p-6 dark:bg-zinc-900 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  <div>
                    <span className="font-mono text-[10px] font-black uppercase text-zinc-400">
                      Active Campaign ID: {activeCampaign.id}
                    </span>
                    <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
                      {activeCampaign.ticketTierName}
                    </h3>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 font-mono text-xs font-black uppercase ${
                      activeCampaign.status === "active"
                        ? "bg-lime text-black animate-pulse"
                        : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {activeCampaign.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">
                      Original Stripe Price
                    </span>
                    <p className="font-bold text-zinc-900 dark:text-white">
                      ${activeCampaign.originalPriceUsd} ({activeCampaign.originalStripePriceId})
                    </p>
                  </div>

                  <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">
                      Active Dynamic Stripe Price
                    </span>
                    <p className="font-bold text-emerald-600">
                      ${activeCampaign.discountedPriceUsd} (-{activeCampaign.discountPercentage}%)
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Marketing Push Blast:</span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      Delivered to {activeCampaign.marketingRecipientsCount} Waitlisted Users
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Scheduled Rollback Time:</span>
                    <span className="font-bold text-amber-600">
                      {new Date(activeCampaign.expiresAt).toLocaleTimeString()} ({timeLeft.formattedString} remaining)
                    </span>
                  </div>
                </div>

                {activeCampaign.status === "active" && (
                  <Button
                    onClick={handleRevertPrice}
                    disabled={isReverting}
                    className="neu-border w-full bg-rose-600 font-mono text-xs font-black uppercase text-white hover:bg-rose-700 shadow-[4px_4px_0_0_#000]"
                  >
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                    {isReverting ? "Reverting Stripe..." : "Emergency Revert Price (Cancel Flash Sale)"}
                  </Button>
                )}
              </div>
            </div>

            {/* Right: Live Purchases Feed (5 cols) */}
            <div className="space-y-4 lg:col-span-5">
              <div className="neu-border bg-white p-4 dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-3 border-b border-zinc-200 pb-2 dark:border-zinc-800">
                  <h4 className="font-mono text-xs font-black uppercase text-zinc-500">
                    Live Flash Purchases ({purchases.length})
                  </h4>
                  <span className="font-mono text-[10px] text-emerald-600 font-bold">
                    +${liquidationMetrics.realizedFlashRevenueUsd} Gross
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {purchases.map((p) => (
                    <div
                      key={p.id}
                      className="neu-border bg-zinc-50 p-2.5 font-mono text-xs dark:bg-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">{p.buyerName}</p>
                        <p className="text-[10px] text-zinc-500">
                          {p.ticketCount} tickets • {new Date(p.purchasedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-emerald-600">+${p.totalPaidUsd}</span>
                        <p className="text-[9px] text-zinc-400 font-mono">Stripe Confirmed</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: 1-Click Launch New Sale */}
        <TabsContent value="launch_sale" className="mt-4">
          <div className="neu-border bg-white p-6 dark:bg-zinc-900 max-w-2xl">
            <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white mb-1">
              Configure & Trigger Flash Sale
            </h3>
            <p className="font-mono text-xs text-zinc-500 mb-6">
              Instantly mutates Stripe pricing, starts countdown timers, and blasts targeted push notifications.
            </p>

            <form onSubmit={handleLaunchFlashSale} className="space-y-4 font-mono text-xs">
              {/* Ticket Tier */}
              <div>
                <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                  Select Target Ticket Tier
                </label>
                <select
                  aria-label="Select Ticket Tier for Flash Sale"
                  value={selectedTierId}
                  onChange={(e) => setSelectedTierId(e.target.value)}
                  className="neu-border w-full bg-zinc-50 p-2 font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                >
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Current Price: ${t.originalPriceUsd} • {t.availableUnsold} unsold)
                    </option>
                  ))}
                </select>
              </div>

              {/* Discount Percentage Slider */}
              <div>
                <div className="flex justify-between font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  <span>Discount Percentage:</span>
                  <span className="text-emerald-600 font-black">{discountPercent}% OFF</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="75"
                  step="5"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-full accent-lime"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                  <span>10% (Early Bird)</span>
                  <span>35% (Surge)</span>
                  <span>50% (Liquidation)</span>
                  <span>75% (Fire Sale)</span>
                </div>
              </div>

              {/* Sale Duration & Ticket Cap */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <select
                    aria-label="Select Sale Duration"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="neu-border w-full bg-zinc-50 p-2 font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                  >
                    <option value={15}>15 Minutes (Super Flash)</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>60 Minutes (Standard)</option>
                    <option value={120}>120 Minutes (2 Hours)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                    Flash Ticket Cap
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={ticketCap}
                    onChange={(e) => setTicketCap(Number(e.target.value))}
                    className="neu-border w-full bg-zinc-50 p-2 font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Target Audience Segment */}
              <div>
                <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                  Push Notification Target Audience
                </label>
                <select
                  aria-label="Select Push Notification Audience"
                  value={targetAudience}
                  onChange={(e) =>
                    setTargetAudience(e.target.value as FlashSaleCreatePayload["targetAudience"])
                  }
                  className="neu-border w-full bg-zinc-50 p-2 font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="waitlist_only">Waitlist Attendees Only (High Intent)</option>
                  <option value="club_followers">Club Followers & Members</option>
                  <option value="past_attendees">Past Event Attendees</option>
                  <option value="campus_wide_public">Campus-Wide Public Push</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={isTriggering}
                className="neu-border w-full bg-lime font-mono text-xs font-black uppercase text-black hover:bg-lime/80 shadow-[4px_4px_0_0_#000] mt-4"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                {isTriggering ? "Mutating Stripe & Blasting Push..." : "Launch Flash Sale Now"}
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* Tab 3: Elasticity Modeler */}
        <TabsContent value="elasticity_modeler" className="mt-4">
          <DynamicPricingElasticitySimulator
            basePrice={selectedTier.originalPriceUsd}
            unsoldInventory={selectedTier.availableUnsold}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InteractiveFlashSaleOrchestrator;
