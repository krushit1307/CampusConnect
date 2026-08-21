import { useEffect, useState } from "react";
import format from "date-fns/format";
import isPast from "date-fns/isPast";
import isFuture from "date-fns/isFuture";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import { Ticket, Clock, CheckCircle, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface TicketTier {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  start_date: string | null;
  end_date: string | null;
  sold_count?: number; // fetched separately
}

export function TicketPricingTimeline({ eventId, isOrganizer }: { eventId: string, isOrganizer?: boolean }) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const supabase = createClient();
  const [now, setNow] = useState(new Date());

  // Update current time every minute for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchTiers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("ticket_tiers")
          .select("id, name, price, capacity, start_date, end_date")
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

        setTiers((data || []).map(t => ({
          ...t,
          sold_count: counts[t.id] || 0
        })));
      } catch (err) {
        console.error("Failed to load ticket tiers", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTiers();
  }, [eventId]);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"}/functions/v1/create-stripe-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            eventId,
            quantity: 1
          })
        }
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

  if (tiers.length === 0) {
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
  const activeIndex = tiers.findIndex(t => getTierState(t) === "active");
  const activeTier = activeIndex !== -1 ? tiers[activeIndex] : null;
  const nextTier = activeIndex !== -1 && activeIndex + 1 < tiers.length ? tiers[activeIndex + 1] : null;

  return (
    <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_rgba(0,0,0,1)] relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <Ticket className="w-6 h-6 text-black" />
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
          Ticket Pricing
        </h2>
      </div>

      {activeTier && activeTier.end_date && (
        <div className="bg-peach/20 border-2 border-black p-3 mb-6 flex items-center gap-3 font-mono text-sm">
          <Clock className="w-5 h-5 text-red-500 animate-pulse" />
          <span>
            🔥 <strong>{activeTier.name}</strong> ends in{" "}
            {formatDistanceToNow(new Date(activeTier.end_date))}!
          </span>
          {nextTier && (
            <span className="ml-auto text-black/60 hidden md:inline">
              Next price: ${(nextTier.price / 100).toFixed(2)}
            </span>
          )}
        </div>
      )}

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
                  ${(tier.price / 100).toFixed(2)}
                </div>
                
                {/* Node */}
                <div className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors
                  ${state === "ended" || state === "sold_out" ? "bg-black" : 
                    isCurrent ? "bg-lime scale-125" : "bg-white"}`}>
                  {state === "ended" && <CheckCircle className="w-4 h-4 text-white" />}
                </div>

                <div className={`mt-3 font-mono text-sm font-bold text-center ${isCurrent ? 'text-black' : 'text-black/60'}`}>
                  {tier.name}
                </div>
                
                <div className="text-xs font-mono text-black/50 text-center mt-1">
                  {state === "ended" ? "Ended" : 
                   state === "sold_out" ? "Sold Out" :
                   tier.start_date && isFuture(new Date(tier.start_date)) ? `Starts ${format(new Date(tier.start_date), "MMM d")}` :
                   tier.end_date ? `Until ${format(new Date(tier.end_date), "MMM d")}` : "Available"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {activeTier ? (
            <p className="font-mono text-sm text-black/70">
              Current Tier: <strong>{activeTier.name}</strong> at ${(activeTier.price / 100).toFixed(2)}
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
          disabled={!activeTier || purchasing}
        >
          {purchasing ? "Processing..." : (activeTier ? `Buy Ticket for $${(activeTier.price / 100).toFixed(2)}` : "Unavailable")}
        </Button>
      </div>
    </div>
  );
}
