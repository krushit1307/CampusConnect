import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Clock,
  Ticket,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  Sliders,
  DollarSign,
  CheckCircle2,
  Users,
  Timer
} from 'lucide-react';
import {
  DutchAuctionService,
  DutchAuction,
  DutchAuctionLiveState
} from '@/services/dutchAuctionService';

interface DutchAuctionDynamicPricingWidgetProps {
  eventId?: string;
  userId?: string;
}

export const DutchAuctionDynamicPricingWidget: React.FC<DutchAuctionDynamicPricingWidgetProps> = ({
  eventId = 'evt-spring-gala-2026',
  userId = 'user-student-123'
}) => {
  // Auction Data State
  const [auction, setAuction] = useState<DutchAuction | null>(null);
  const [liveState, setLiveState] = useState<DutchAuctionLiveState | null>(null);

  // Simulation Sliders
  const [startPrice, setStartPrice] = useState<number>(85.0);
  const [floorPrice, setFloorPrice] = useState<number>(25.0);
  const [dropAmount, setDropAmount] = useState<number>(2.0);
  const [dropInterval, setDropInterval] = useState<number>(15);

  // Purchase State
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [purchaseReceipt, setPurchaseReceipt] = useState<{
    rsvpId: string;
    purchaseId: string;
    pricePaid: number;
  } | null>(null);

  // Load initial auction data
  useEffect(() => {
    const fetchAuction = async () => {
      const data = await DutchAuctionService.getActiveAuction(eventId);
      if (data) {
        setAuction(data);
        setStartPrice(data.start_price_cents / 100);
        setFloorPrice(data.min_price_cents / 100);
        setDropAmount(data.price_drop_amount_cents / 100);
        setDropInterval(data.price_drop_interval_seconds);
      }
    };
    fetchAuction();
  }, [eventId]);

  // Live timer loop recalculating price every 1000ms
  useEffect(() => {
    if (!auction) return;

    // Create virtual updated auction incorporating slider adjustments
    const currentAuctionConfig: DutchAuction = {
      ...auction,
      start_price_cents: Math.round(startPrice * 100),
      min_price_cents: Math.round(floorPrice * 100),
      price_drop_amount_cents: Math.round(dropAmount * 100),
      price_drop_interval_seconds: dropInterval
    };

    const updateLivePrice = () => {
      const state = DutchAuctionService.calculateLiveDynamicPrice(currentAuctionConfig, new Date());
      setLiveState(state);
    };

    updateLivePrice();
    const interval = setInterval(updateLivePrice, 1000);

    return () => clearInterval(interval);
  }, [auction, startPrice, floorPrice, dropAmount, dropInterval]);

  // Handle Ticket Purchase
  const handlePurchase = async () => {
    if (!auction || !liveState) return;
    setIsPurchasing(true);

    const res = await DutchAuctionService.purchaseTicket(
      auction.id,
      userId,
      liveState.current_price_cents
    );

    setIsPurchasing(false);

    if (res.success) {
      setPurchaseReceipt({
        rsvpId: res.rsvpId || `rsvp-${Date.now()}`,
        purchaseId: res.purchaseId || `purch-${Date.now()}`,
        pricePaid: liveState.current_price_usd
      });
      // Deduct inventory in live view
      setAuction((prev) =>
        prev
          ? {
              ...prev,
              tickets_sold: (prev.tickets_sold || 0) + 1
            }
          : null
      );
    }
  };

  if (!auction || !liveState) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono animate-pulse">
        Initializing Real-Time Dutch Auction Engine...
      </div>
    );
  }

  // Calculate interval progress bar percentage
  const intervalProgress = Math.min(
    100,
    Math.max(0, ((dropInterval - liveState.seconds_until_next_drop) / dropInterval) * 100)
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-100 p-4 font-sans">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-rose-950/40 to-slate-900 p-6 md:p-8 border border-rose-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <Zap className="w-3.5 h-3.5" /> High-Speed Dutch Auction
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live Dynamic Decay
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {auction.event_title}
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Venue: <strong className="text-slate-200">{auction.venue_name}</strong>
            </p>
          </div>

          <div className="flex flex-col items-end justify-center bg-slate-950/70 p-4 rounded-2xl border border-slate-800 shrink-0">
            <div className="text-xs text-slate-400 uppercase font-semibold">Price Drop Countdown</div>
            <div className="text-2xl font-black text-rose-400 font-mono flex items-center gap-2 mt-1">
              <Timer className="w-5 h-5 text-rose-400 animate-spin" />
              00:{liveState.seconds_until_next_drop.toString().padStart(2, '0')}
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden w-36">
              <div
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${intervalProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Price Display & Purchase Action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Giant Live Dynamic Price Display */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-3xl bg-slate-900/90 backdrop-blur border border-slate-800 p-8 shadow-xl space-y-6 relative overflow-hidden flex flex-col items-center justify-center text-center">
            <div className="w-full flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-emerald-400" /> Current Live Dynamic Price
              </span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                {liveState.discount_percentage}% OFF START PRICE
              </span>
            </div>

            {/* Giant Dynamic Price Counter */}
            <div className="my-4 space-y-1">
              <div className="text-6xl md:text-7xl font-black tracking-tight text-white flex items-center justify-center">
                <span className="text-3xl text-emerald-400 font-bold">$</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-white">
                  {liveState.current_price_usd.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Start: ${liveState.start_price_usd.toFixed(2)} • Floor Reserve: ${liveState.min_price_usd.toFixed(2)}
              </p>
            </div>

            {/* Total Savings & Next Drop Indicator */}
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-[10px] uppercase text-emerald-300 font-semibold">Your Total Savings</div>
                <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
                  ${liveState.total_savings_usd.toFixed(2)} USD
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-center">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Next Price Drop</div>
                <div className="text-xl font-bold text-slate-200 font-mono mt-0.5">
                  ${liveState.next_price_usd.toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Purchase Action Button */}
            <button
              onClick={handlePurchase}
              disabled={isPurchasing || liveState.tickets_remaining <= 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-lg transition shadow-xl shadow-emerald-500/20 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <ShoppingBag className="w-6 h-6" />
              {isPurchasing
                ? 'Locking Price & Minting Ticket...'
                : liveState.tickets_remaining <= 0
                ? 'SOLD OUT'
                : `Lock Price & Buy Ticket Now ($${liveState.current_price_usd.toFixed(2)})`}
            </button>
          </div>
        </div>

        {/* Right Column: Inventory & Sellout Velocity */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-3xl bg-slate-900/90 backdrop-blur border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Ticket className="w-4 h-4 text-indigo-400" /> Inventory & Demand Velocity
              </h3>
              <span className="text-xs font-mono text-slate-400">Live Telemetry</span>
            </div>

            {/* Inventory Remaining Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Tickets Available</span>
                <span className="text-white font-mono font-bold">
                  {liveState.tickets_remaining} of {liveState.total_tickets} remaining
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-500"
                  style={{
                    width: `${Math.round((liveState.tickets_remaining / liveState.total_tickets) * 100)}%`
                  }}
                />
              </div>
            </div>

            {/* Sellout Risk Pill */}
            <div
              className={`p-4 rounded-2xl border text-center ${
                liveState.sellout_risk === 'HIGH_RISK_SELLOUT'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : liveState.sellout_risk === 'MODERATE'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center justify-center gap-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                {liveState.sellout_risk === 'HIGH_RISK_SELLOUT'
                  ? 'HIGH SELLOUT RISK - Buy Before Next Drop!'
                  : liveState.sellout_risk === 'MODERATE'
                  ? 'MODERATE DEMAND - Steady Purchases'
                  : 'NOMINAL INVENTORY'}
              </div>
              <p className="text-xs mt-1 text-slate-300">
                Waiting for the next price drop risks another attendee purchasing the remaining tickets.
              </p>
            </div>

            {/* Audience Watching Indicator */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs">
              <span className="text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Active Student Watchers
              </span>
              <span className="font-bold font-mono text-indigo-300">78 Watching Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Dutch Auction Price Decay Simulator */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 md:p-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Dutch Auction Price Decay Simulator
            </h3>
          </div>
          <button
            onClick={() => {
              setStartPrice(85.0);
              setFloorPrice(25.0);
              setDropAmount(2.0);
              setDropInterval(15);
            }}
            className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          {/* Start Price Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Start Price ($USD)</span>
              <span className="text-white font-mono font-bold">${startPrice.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              step="5"
              value={startPrice}
              onChange={(e) => setStartPrice(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Floor Price Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Floor Reserve ($USD)</span>
              <span className="text-emerald-400 font-mono font-bold">${floorPrice.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={floorPrice}
              onChange={(e) => setFloorPrice(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Price Drop Amount Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Drop Step Amount</span>
              <span className="text-rose-400 font-mono font-bold">-${dropAmount.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={dropAmount}
              onChange={(e) => setDropAmount(parseFloat(e.target.value))}
              className="w-full accent-rose-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Drop Interval Sec Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Drop Interval (sec)</span>
              <span className="text-amber-400 font-mono font-bold">{dropInterval}s</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={dropInterval}
              onChange={(e) => setDropInterval(parseInt(e.target.value, 10))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Instant Purchase Receipt Modal */}
      {purchaseReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-extrabold text-white">Dutch Auction Purchase Confirmed!</h2>
            <p className="text-xs text-slate-300">
              You locked in your ticket at the dynamic price of{' '}
              <strong className="text-emerald-400 font-mono">${purchaseReceipt.pricePaid.toFixed(2)} USD</strong>.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>RSVP ID:</span> <span className="text-slate-200">{purchaseReceipt.rsvpId}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Purchase ID:</span> <span className="text-slate-200">{purchaseReceipt.purchaseId}</span>
              </div>
            </div>

            <button
              onClick={() => setPurchaseReceipt(null)}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DutchAuctionDynamicPricingWidget;
