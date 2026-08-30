// =============================================================================
// Component: DutchAuctionPanel
// Purpose: Displays ticking Dutch Auction prices and handles transactional
//   purchases with slippage protection and Supabase Realtime syncing.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { DutchAuctionService, type DutchAuction } from "@/services/dutchAuctionService";
import { Button } from "@/components/ui/button";
import Clock from "lucide-react/dist/esm/icons/clock";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Ticket from "lucide-react/dist/esm/icons/ticket";

interface DutchAuctionPanelProps {
  eventId: string;
}

export function DutchAuctionPanel({ eventId }: DutchAuctionPanelProps) {
  const [auction, setAuction] = useState<DutchAuction | null>(null);
  const [currentPriceCents, setCurrentPriceCents] = useState<number>(0);
  const [secondsToNextDrop, setSecondsToNextDrop] = useState<number>(0);
  const [remainingCapacity, setRemainingCapacity] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [myRsvp, setMyRsvp] = useState<boolean>(false);

  // Slippage state: default to starting price in dollars
  const [maxPriceDollars, setMaxPriceDollars] = useState<string>("35.00");

  const refreshAuctionPriceAndCapacity = useCallback(async (auc: DutchAuction) => {
    // 1. Calculate active ticking price from DB RPC
    const price = await DutchAuctionService.getCurrentPrice(auc.id);
    setCurrentPriceCents(price);

    // 2. Fetch remaining tickets capacity
    const { data: tier } = await supabase
      .from("ticket_tiers")
      .select("capacity")
      .eq("id", auc.ticket_tier_id)
      .single();

    const { count } = await supabase
      .from("event_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("ticket_tier_id", auc.ticket_tier_id)
      .eq("status", "approved");

    if (tier) {
      setRemainingCapacity(Math.max(0, tier.capacity - (count || 0)));
    }
  }, []);

  // Fetch auction details on mount
  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setUser(user);

      if (user) {
        const { data: rsvp } = await supabase
          .from("event_rsvps")
          .select("id")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .eq("status", "approved")
          .maybeSingle();
        if (rsvp && active) setMyRsvp(true);
      }

      const activeAuc = await DutchAuctionService.getActiveAuction(eventId);
      if (!active || !activeAuc) return;

      setAuction(activeAuc);
      void refreshAuctionPriceAndCapacity(activeAuc);
    };

    void init();
    return () => {
      active = false;
    };
  }, [eventId, refreshAuctionPriceAndCapacity]);

  // Pricing timer & ticking countdown
  useEffect(() => {
    if (!auction || !auction.is_active) return;

    const intervalId = setInterval(() => {
      const now = new Date();
      const startTime = new Date(auction.starts_at);
      const endTime = new Date(auction.ends_at);

      if (now < startTime) {
        // Auction hasn't started yet
        setCurrentPriceCents(auction.start_price_cents);
        const diff = Math.ceil((startTime.getTime() - now.getTime()) / 1000);
        setSecondsToNextDrop(diff);
        return;
      }

      if (now >= endTime) {
        // Auction ended/expired
        setCurrentPriceCents(auction.min_price_cents);
        setSecondsToNextDrop(0);
        return;
      }

      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const intervalSeconds = auction.price_drop_interval_seconds;
      const secondsPassedInCurrentInterval = elapsed % intervalSeconds;
      const nextDropCountdown = intervalSeconds - secondsPassedInCurrentInterval;
      setSecondsToNextDrop(nextDropCountdown);

      // Recalculate ticking price client side
      const drops = Math.floor(elapsed / intervalSeconds);
      const calculatedPrice = auction.start_price_cents - drops * auction.price_drop_amount_cents;
      setCurrentPriceCents(Math.max(calculatedPrice, auction.min_price_cents));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [auction]);

  // Supabase Realtime synchronization
  useEffect(() => {
    if (!auction) return;

    const channel = supabase
      .channel(`dutch-auction-realtime-${auction.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dutch_auctions",
          filter: `id=eq.${auction.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setAuction(payload.new as DutchAuction);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_rsvps",
          filter: `ticket_tier_id=eq.${auction.ticket_tier_id}`,
        },
        () => {
          void refreshAuctionPriceAndCapacity(auction);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [auction, refreshAuctionPriceAndCapacity]);

  const handlePurchase = async () => {
    if (!auction) return;
    if (!user) {
      toast.error("Please log in to purchase tickets.");
      return;
    }

    const maxPriceCents = Math.round(parseFloat(maxPriceDollars) * 100);
    if (isNaN(maxPriceCents) || maxPriceCents <= 0) {
      toast.error("Please enter a valid maximum price limit.");
      return;
    }

    setLoading(true);
    toast.info("Submitting transactional Dutch Auction checkout...");

    try {
      const result = await DutchAuctionService.purchaseTicket(
        auction.id,
        user.id,
        maxPriceCents
      );

      if (result.success) {
        setMyRsvp(true);
        toast.success(
          `Ticket Purchased successfully at $${((result.pricePaidCents || 0) / 100).toFixed(2)}!`
        );
        void refreshAuctionPriceAndCapacity(auction);
      } else {
        toast.error(result.error || "Purchase failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Purchase processing error");
    } finally {
      setLoading(false);
    }
  };

  if (!auction) return null;

  const currentPriceDollars = (currentPriceCents / 100).toFixed(2);
  const minPriceDollars = (auction.min_price_cents / 100).toFixed(2);
  const startPriceDollars = (auction.start_price_cents / 100).toFixed(2);

  const isSoldOut = remainingCapacity === 0;
  const isAuctionExpired = new Date() >= new Date(auction.ends_at);
  const hasStarted = new Date() >= new Date(auction.starts_at);

  return (
    <div
      className="border-4 border-black bg-yellow-300 p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono relative overflow-hidden"
      data-testid="dutch-auction-panel"
    >
      {/* Dynamic diagonal stripe */}
      <div className="absolute top-0 right-0 bg-black text-white font-black px-8 py-1 rotate-45 translate-x-6 translate-y-3 uppercase text-[10px]">
        Dutch Auction
      </div>

      <h3 className="flex items-center gap-2 text-2xl font-black uppercase text-black">
        <TrendingDown className="h-6 w-6 animate-bounce" /> Last-Minute Liquidation!
      </h3>
      <p className="mt-1 text-xs font-bold text-black/80">
        Prices drop automatically by ${(auction.price_drop_amount_cents / 100).toFixed(2)} every{" "}
        {auction.price_drop_interval_seconds}s. Buy now to secure your seat before they sell out!
      </p>

      {/* Grid Display */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Price Card */}
        <div className="border-3 border-black bg-white p-4 flex flex-col items-center justify-center">
          <span className="text-[10px] font-black uppercase text-gray-500">Current Price</span>
          <span className="text-4xl font-black text-black" data-testid="dutch-current-price">
            ${currentPriceDollars}
          </span>
          <span className="text-[9px] font-bold text-gray-400 mt-1">
            Min Floor: ${minPriceDollars} | Start: ${startPriceDollars}
          </span>
        </div>

        {/* Ticking Clock Card */}
        <div className="border-3 border-black bg-white p-4 flex flex-col items-center justify-center">
          <Clock className="h-5 w-5 text-black mb-1 animate-spin-slow" />
          <span className="text-[10px] font-black uppercase text-gray-500">
            {!hasStarted ? "Starts In" : isAuctionExpired ? "Auction Status" : "Next Price Drop"}
          </span>
          <span className="text-xl font-black text-red-600 animate-pulse" data-testid="dutch-ticking-clock">
            {!hasStarted
              ? `${Math.floor(secondsToNextDrop / 60)}m ${secondsToNextDrop % 60}s`
              : isAuctionExpired
              ? "EXPIRED"
              : `${secondsToNextDrop}s`}
          </span>
        </div>

        {/* Inventory Card */}
        <div className="border-3 border-black bg-white p-4 flex flex-col items-center justify-center">
          <Ticket className="h-5 w-5 text-black mb-1" />
          <span className="text-[10px] font-black uppercase text-gray-500">Tickets Available</span>
          <span className="text-2xl font-black text-black" data-testid="dutch-remaining-tickets">
            {remainingCapacity !== null ? `${remainingCapacity} Left` : "Loading..."}
          </span>
        </div>
      </div>

      {/* Buying Controls */}
      <div className="mt-6 border-t-2 border-black/20 pt-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        {myRsvp ? (
          <div className="w-full bg-black text-white p-3 text-center font-bold border-2 border-black">
            Ticket Secured ✓ (Registered at Auction)
          </div>
        ) : isSoldOut ? (
          <div className="w-full bg-red-500 text-white p-3 text-center font-bold border-2 border-black">
            SOLD OUT: All dynamic inventory has cleared.
          </div>
        ) : isAuctionExpired ? (
          <div className="w-full bg-gray-400 text-black p-3 text-center font-bold border-2 border-black">
            Closed: Dutch Auction timeframe has completed.
          </div>
        ) : (
          <>
            {/* Slippage Protection Input */}
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-600">
                  Max Slippage Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={maxPriceDollars}
                  onChange={(e) => setMaxPriceDollars(e.target.value)}
                  className="border-2 border-black px-2 py-1 font-mono text-sm w-24 outline-none bg-white text-black"
                  data-testid="dutch-max-price-input"
                />
              </div>
            </div>

            {/* Buy Button */}
            <Button
              onClick={handlePurchase}
              disabled={loading || !hasStarted}
              className="w-full md:w-auto neu-border neu-press bg-black text-yellow-300 font-mono font-black uppercase px-6 py-3"
              data-testid="dutch-buy-btn"
            >
              {loading ? "Processing..." : `Buy Now at $${currentPriceDollars}`}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
