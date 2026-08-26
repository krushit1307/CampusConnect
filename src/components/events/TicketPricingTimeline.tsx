import { useEffect, useState } from "react";
import format from "date-fns/format";
import isPast from "date-fns/isPast";
import isFuture from "date-fns/isFuture";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import { Ticket, Clock, CheckCircle, Info, Flame, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { CurrencyEstimate } from "@/components/CurrencyEstimate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { isFlashSaleRealtimePayload, type ActiveFlashSale } from "@/lib/flashSale";
import { evaluateEarlyBirdThreshold } from "@/lib/dynamicEarlyBirdThresholds";

interface TicketTier {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  capacity_percentage?: number | null;
  is_dynamic_capacity?: boolean;
  start_date: string | null;
  end_date: string | null;
  sold_count?: number; // fetched separately
}

export function TicketPricingTimeline({
  eventId,
  isOrganizer,
}: {
  eventId: string;
  isOrganizer?: boolean;
}) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [venueCapacity, setVenueCapacity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [preferredCurrency, setPreferredCurrency] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [isDynamic, setIsDynamic] = useState(false);
  const [dynamicPrice, setDynamicPrice] = useState<number | null>(null);
  const [ticketsUntilIncrease, setTicketsUntilIncrease] = useState<number | null>(null);
  const [flashSale, setFlashSale] = useState<ActiveFlashSale | null>(null);
  const [isGroupRsvp, setIsGroupRsvp] = useState(false);
  const [friendEmails, setFriendEmails] = useState<string[]>(["", "", "", ""]);

  useEffect(() => {
    let cancelled = false;

    const loadCurrencyPreference = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_currency")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setPreferredCurrency(data?.preferred_currency ?? null);
    };

    void loadCurrencyPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  // Update current time every minute for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    const saleChannel = supabase
      .channel(`event-flash-sale:${eventId}`)
      .on("broadcast", { event: "flash-sale" }, ({ payload }) => {
        if (!isFlashSaleRealtimePayload(payload) || payload.eventId !== eventId) return;
        setFlashSale((previous) => ({
          id: payload.saleId,
          event_id: eventId,
          ticket_tier_id: previous?.ticket_tier_id ?? null,
          discount_percent: payload.discountPercent ?? previous?.discount_percent ?? 0,
          original_price_cents: previous?.original_price_cents ?? 0,
          sale_price_cents: payload.salePriceCents ?? previous?.sale_price_cents ?? 0,
          starts_at: new Date().toISOString(),
          expires_at: payload.expiresAt ?? previous?.expires_at ?? new Date().toISOString(),
          status: "active",
        }));
      })
      .on("broadcast", { event: "flash-sale-ended" }, ({ payload }) => {
        if (isFlashSaleRealtimePayload(payload) && payload.eventId === eventId) setFlashSale(null);
      })
      .subscribe();

    const fetchTiers = async () => {
      setLoading(true);
      try {
        // Fetch event's dynamic pricing details and venue capacity
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("base_price, surge_multiplier, venue_capacity, max_attendees")
          .eq("id", eventId)
          .single();

        if (eventData) {
          setVenueCapacity(eventData.venue_capacity ?? eventData.max_attendees ?? null);
        }

        if (!eventError && eventData && eventData.base_price !== null) {
          setIsDynamic(true);
          const { data: dynPrice } = await supabase.rpc("calculate_current_price", {
            p_event_id: eventId,
          });
          setDynamicPrice(dynPrice);

          const { data: tUntilIncrease } = await supabase.rpc("tickets_until_price_increase", {
            p_event_id: eventId,
          });
          setTicketsUntilIncrease(tUntilIncrease);
        }

        const { data: saleData } = await supabase
          .from("active_event_flash_sales")
          .select(
            "id, event_id, ticket_tier_id, discount_percent, original_price_cents, sale_price_cents, starts_at, expires_at, status",
          )
          .eq("event_id", eventId)
          .maybeSingle();
        if (mounted) setFlashSale(saleData as ActiveFlashSale | null);

        const { data, error } = await supabase
          .from("ticket_tiers")
          .select(
            "id, name, price, capacity, capacity_percentage, is_dynamic_capacity, start_date, end_date",
          )
          .eq("event_id", eventId)
          .order("start_date", { ascending: true, nullsFirst: false });

        if (error) throw error;

        // Also fetch sold counts to determine capacity
        const { data: rsvps, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select("ticket_tier_id")
          .eq("event_id", eventId);

        if (rsvpError) throw rsvpError;

        const counts = (rsvps || []).reduce((acc: any, rsvp) => {
          if (rsvp.ticket_tier_id) {
            acc[rsvp.ticket_tier_id] = (acc[rsvp.ticket_tier_id] || 0) + 1;
          }
          return acc;
        }, {});

        setTiers(
          (data || []).map((t) => ({
            ...t,
            sold_count: counts[t.id] || 0,
          })),
        );
      } catch (err) {
        console.error("Failed to load ticket pricing info", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchTiers();
    return () => {
      mounted = false;
      void saleChannel.unsubscribe();
    };
  }, [eventId]);

  const handlePurchase = async () => {
    setPurchasing(true);
    const activeEmails = isGroupRsvp ? friendEmails.filter((e) => e.trim() !== "") : [];
    if (isGroupRsvp && activeEmails.length !== 4) {
      toast.error(
        "Please provide exactly 4 friend emails to receive the Buy 4, Get 1 Free discount!",
      );
      setPurchasing(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"}/functions/v1/create-stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            eventId,
            quantity: isGroupRsvp ? 5 : 1,
            friendEmails: isGroupRsvp ? activeEmails : [],
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to initialize checkout");

      window.location.href = result.url;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to purchase ticket");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <div className="h-32 bg-gray-100 animate-pulse rounded-lg border-2 border-black"></div>;
  }

  if (tiers.length === 0 && !isDynamic && !flashSale) {
    return null;
  }

  const getTierState = (tier: TicketTier) => {
    const hasStarted = !tier.start_date || isPast(new Date(tier.start_date));
    const hasEnded = tier.end_date && isPast(new Date(tier.end_date));
    const isSoldOut = tier.capacity !== null && (tier.sold_count || 0) >= tier.capacity;

    if (hasEnded) return "ended";
    if (isSoldOut) return "sold_out";
    if (hasStarted) return "active";
    return "upcoming";
  };

  // The active tier visually is the first one that is "active"
  const activeIndex = tiers.findIndex((t) => getTierState(t) === "active");
  const activeTier = activeIndex !== -1 ? tiers[activeIndex] : null;
  const nextTier =
    activeIndex !== -1 && activeIndex + 1 < tiers.length ? tiers[activeIndex + 1] : null;

  return (
    <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <Ticket className="w-6 h-6 text-black" />
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
          Ticket Pricing
        </h2>
      </div>

      {isDynamic && ticketsUntilIncrease !== null && (
        <div className="bg-amber-100 border-2 border-black p-3 mb-6 flex items-center gap-3 font-mono text-sm text-amber-950">
          <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
          <span>
            🔥{" "}
            <strong>
              Price increases in {ticketsUntilIncrease} ticket{ticketsUntilIncrease > 1 ? "s" : ""}!
            </strong>{" "}
            Buy now.
          </span>
        </div>
      )}

      {!isDynamic && activeTier && (
        <div className="bg-peach/20 border-2 border-black p-3 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-sm">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
            <div>
              <span>
                🔥 <strong>{activeTier.name}</strong>
                {activeTier.end_date &&
                  ` ends in ${formatDistanceToNow(new Date(activeTier.end_date))}!`}
              </span>
              {activeTier.capacity_percentage && (
                <span className="block text-xs text-black/70 mt-0.5">
                  Allocation: {activeTier.capacity_percentage}% of venue capacity
                  {activeTier.sold_count !== undefined &&
                    activeTier.capacity &&
                    ` (${Math.max(0, activeTier.capacity - activeTier.sold_count)} of ${activeTier.capacity} remaining)`}
                </span>
              )}
            </div>
          </div>
          {nextTier && (
            <span className="text-black/60 font-bold text-xs whitespace-nowrap">
              Next price: ${(nextTier.price / 100).toFixed(2)} USD
            </span>
          )}
        </div>
      )}

      {flashSale ? (
        <div className="my-6 border-4 border-black bg-red-600 p-4 font-mono text-white shadow-[4px_4px_0_0_#000]">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
            <Flame className="h-4 w-4 animate-pulse" /> Flash sale pricing applied at checkout
          </p>
          <p className="mt-2 font-display text-3xl font-black uppercase">
            {flashSale.discount_percent}% off
          </p>
          <p className="mt-1 text-sm">
            Sale price: <strong>${(flashSale.sale_price_cents / 100).toFixed(2)} USD</strong>{" "}
            <span className="ml-2 text-white/70 line-through">
              ${(flashSale.original_price_cents / 100).toFixed(2)}
            </span>
          </p>
        </div>
      ) : isDynamic ? (
        <div className="my-6 bg-slate-50 border-2 border-black p-4 rounded-lg font-mono text-sm text-slate-800 flex items-start gap-3">
          <TrendingUp className="w-6 h-6 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-black uppercase mb-1">Algorithmic Demand-Based Pricing</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              This event uses real-time surge pricing. Prices adjust dynamically based on capacity
              demand and remaining tickets. Secure your spot early to lock in a lower rate!
            </p>
          </div>
        </div>
      ) : (
        <div className="relative pt-8 pb-4">
          {/* Timeline line */}
          <div className="absolute top-12 left-0 right-0 h-1 bg-black z-0"></div>

          <div className="flex justify-between relative z-10">
            {tiers.map((tier, idx) => {
              const state = getTierState(tier);
              const isCurrent = idx === activeIndex;

              return (
                <div key={tier.id} className="flex flex-col items-center flex-1">
                  <div className="text-lg font-black font-display mb-2">
                    ${(tier.price / 100).toFixed(2)} USD
                  </div>

                  {/* Node */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors
                    ${
                      state === "ended" || state === "sold_out"
                        ? "bg-black"
                        : isCurrent
                          ? "bg-lime scale-125"
                          : "bg-white"
                    }`}
                  >
                    {state === "ended" && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>

                  <div
                    className={`mt-3 font-mono text-sm font-bold text-center ${isCurrent ? "text-black" : "text-black/60"}`}
                  >
                    {tier.name}
                  </div>

                  <div className="text-xs font-mono text-black/50 text-center mt-1">
                    {state === "ended"
                      ? "Ended"
                      : state === "sold_out"
                        ? "Sold Out"
                        : tier.start_date && isFuture(new Date(tier.start_date))
                          ? `Starts ${format(new Date(tier.start_date), "MMM d")}`
                          : tier.end_date
                            ? `Until ${format(new Date(tier.end_date), "MMM d")}`
                            : "Available"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Group RSVP Discount Section */}
      {(activeTier || isDynamic || flashSale) && (
        <div className="mt-6 border-t-2 border-black/10 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="group-rsvp-checkbox"
              checked={isGroupRsvp}
              onChange={(e) => setIsGroupRsvp(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-black text-lime focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <label
              htmlFor="group-rsvp-checkbox"
              className="font-mono text-sm font-bold uppercase tracking-wider cursor-pointer"
            >
              👥 Buy for a Group (Buy 4, Get 1 Ticket Free!)
            </label>
          </div>

          {isGroupRsvp && (
            <div className="bg-cream border-2 border-black p-4 rounded-lg flex flex-col gap-3 font-mono text-sm">
              <p className="text-xs text-black/70 font-semibold uppercase tracking-wide">
                Enter your 4 friends' emails to invite them. They must be registered platform users.
              </p>
              {friendEmails.map((email, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <label
                    htmlFor={`friend-email-${idx}`}
                    className="text-[10px] font-bold uppercase"
                  >
                    Friend {idx + 1} Email
                  </label>
                  <input
                    id={`friend-email-${idx}`}
                    type="email"
                    placeholder="friend@college.edu"
                    value={email}
                    onChange={(e) => {
                      const updated = [...friendEmails];
                      updated[idx] = e.target.value;
                      setFriendEmails(updated);
                    }}
                    className="border-2 border-black rounded-md px-3 py-1.5 bg-white text-sm focus:outline-none"
                  />
                </div>
              ))}
              <div className="bg-lime/20 border border-black/30 p-2 rounded text-xs text-center font-bold">
                🎉 Buy 4, Get 1 Free coupon discount will be automatically applied at checkout!
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 pt-6 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {flashSale ? (
            <p className="font-mono text-sm text-black/70">
              Flash Sale:{" "}
              <strong className="text-lg text-red-600">
                ${(flashSale.sale_price_cents / 100).toFixed(2)} USD
              </strong>
              <span className="ml-2 text-black/50 line-through">
                ${(flashSale.original_price_cents / 100).toFixed(2)}
              </span>
            </p>
          ) : isDynamic && dynamicPrice !== null ? (
            <p className="font-mono text-sm text-black/70">
              Current Surge Price:{" "}
              <strong className="text-lg text-black">${(dynamicPrice / 100).toFixed(2)} USD</strong>
              <CurrencyEstimate
                amountUsd={dynamicPrice / 100}
                preferredCurrency={preferredCurrency}
              />
            </p>
          ) : activeTier ? (
            <p className="font-mono text-sm text-black/70">
              Current Tier: <strong>{activeTier.name}</strong> at $
              {(activeTier.price / 100).toFixed(2)} USD
              <CurrencyEstimate
                amountUsd={activeTier.price / 100}
                preferredCurrency={preferredCurrency}
              />
              {activeTier.capacity !== null && (
                <span className="block mt-1">
                  Capacity: {activeTier.capacity - (activeTier.sold_count || 0)} remaining
                </span>
              )}
            </p>
          ) : (
            <p className="font-mono text-sm text-black/70 flex items-center gap-2">
              <Info className="w-4 h-4" /> No tickets currently available.
            </p>
          )}
        </div>

        <Button
          size="lg"
          className="w-full sm:w-auto font-display font-black uppercase tracking-widest bg-lime hover:bg-lime/80 text-black border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handlePurchase}
          disabled={(!activeTier && !isDynamic && !flashSale) || purchasing}
        >
          {purchasing
            ? "Processing..."
            : flashSale
              ? `Buy Ticket for $${(flashSale.sale_price_cents / 100).toFixed(2)} USD`
              : isDynamic && dynamicPrice !== null
                ? `Buy Ticket for $${(dynamicPrice / 100).toFixed(2)} USD`
                : activeTier
                  ? `Buy Ticket for $${(activeTier.price / 100).toFixed(2)} USD`
                  : "Unavailable"}
        </Button>
      </div>
    </div>
  );
}
