import { useCallback, useEffect, useMemo, useState } from "react";
import format from "date-fns/format";
import { Banknote, Coins, Loader2, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  formatBarterAmount,
  parseBarterAmount,
  type BarterConsiderationType,
} from "@/lib/resourceBarter";

interface BarterableBooking {
  reservation_id: string;
  item_id: string;
  item_name: string;
  owner_club_id: string;
  owner_club_name: string;
  owner_club_slug: string;
  start_time: string;
  end_time: string;
  current_booking_club_id: string;
}

interface BarterOffer {
  id: string;
  reservation_id: string;
  item_id: string;
  item_name: string;
  owner_club_id: string;
  owner_club_name: string;
  offer_club_id: string;
  offer_club_name: string;
  offered_by: string;
  consideration_type: "points" | "ledger";
  amount_points: number | null;
  amount_cents: number | null;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  start_time: string;
  end_time: string;
  created_at: string;
  responded_at: string | null;
}

type ConsiderationType = BarterConsiderationType;

export function ResourceBarterMarket({ clubId }: { clubId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [bookings, setBookings] = useState<BarterableBooking[]>([]);
  const [offers, setOffers] = useState<BarterOffer[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BarterableBooking | null>(null);
  const [considerationType, setConsiderationType] = useState<ConsiderationType>("points");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadMarket = useCallback(async () => {
    setIsLoading(true);
    const [bookingsResponse, offersResponse] = await Promise.all([
      supabase.rpc("get_barterable_resource_bookings", { p_offer_club_id: clubId }),
      supabase.rpc("get_resource_barter_offers", { p_club_id: clubId }),
    ]);

    if (bookingsResponse.error) {
      setBookings([]);
    } else {
      setBookings((bookingsResponse.data ?? []) as BarterableBooking[]);
    }
    if (offersResponse.error) {
      setOffers([]);
    } else {
      setOffers((offersResponse.data ?? []) as BarterOffer[]);
    }
    setIsLoading(false);
  }, [clubId, supabase]);

  useEffect(() => {
    void loadMarket();
    const channel = supabase
      .channel(`resource-barter-${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_barter_offers" },
        () => void loadMarket(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clubId, loadMarket, supabase]);

  const submitOffer = async () => {
    if (!selectedBooking) return;
    const parsedAmount = parseBarterAmount(amount, considerationType);
    if (!parsedAmount) {
      toast.error("Enter an offer greater than zero.");
      return;
    }

    const rpcInput = {
      p_amount_points: parsedAmount.amountPoints,
      p_amount_cents: parsedAmount.amountCents,
    };

    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_resource_barter_offer", {
        p_reservation_id: selectedBooking.reservation_id,
        p_offer_club_id: clubId,
        p_consideration_type: considerationType,
        ...rpcInput,
      });
      if (error) throw new Error(error.message);
      toast.success("Offer sent to the booking club.");
      setSelectedBooking(null);
      setAmount("");
      await loadMarket();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the offer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const respondToOffer = async (offerId: string, accept: boolean) => {
    setRespondingId(offerId);
    try {
      const { error } = await supabase.rpc("respond_to_resource_barter_offer", {
        p_offer_id: offerId,
        p_accept: accept,
      });
      if (error) throw new Error(error.message);
      toast.success(accept ? "Booking transferred and consideration settled." : "Offer declined.");
      await loadMarket();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not respond to the offer.");
    } finally {
      setRespondingId(null);
    }
  };

  if (isLoading && bookings.length === 0 && offers.length === 0) {
    return (
      <section className="neu-border mt-8 bg-white p-6" aria-label="Resource barter market">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading barter market" />
      </section>
    );
  }

  const incomingOffers = offers.filter((offer) => offer.owner_club_id === clubId);
  const outgoingOffers = offers.filter((offer) => offer.offer_club_id === clubId);

  return (
    <section className="neu-border mt-8 bg-lavender p-6" aria-labelledby="resource-barter-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
            Liquidity layer
          </p>
          <h2 id="resource-barter-title" className="font-display text-2xl font-bold uppercase">
            Inter-club barter market
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs text-gray-700">
            See future approved bookings held by other clubs and offer points or ledger value to
            take over an idle slot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMarket()}
          className="neu-border neu-press inline-flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
        </button>
      </div>

      {bookings.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold uppercase">
            Future bookings available to negotiate
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {bookings.map((booking) => (
              <article key={booking.reservation_id} className="neu-border bg-white p-4">
                <p className="font-display text-lg font-bold">{booking.item_name}</p>
                <p className="font-mono text-xs text-gray-700">
                  Held by <span className="font-bold">{booking.owner_club_name}</span>
                </p>
                <p className="mt-2 font-mono text-xs">
                  {format(new Date(booking.start_time), "PPP p")} –{" "}
                  {format(new Date(booking.end_time), "p")}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(booking)}
                  className="neu-border neu-press mt-4 inline-flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-white hover:bg-lime hover:text-black"
                >
                  <Send className="h-4 w-4" aria-hidden="true" /> Make an offer
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {incomingOffers.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold uppercase">
            Offers for your club&apos;s bookings
          </h3>
          <div className="mt-3 space-y-3">
            {incomingOffers.map((offer) => (
              <div key={offer.id} className="neu-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-bold">{offer.item_name}</p>
                    <p className="font-mono text-xs">
                      {offer.offer_club_name} offers{" "}
                      {formatBarterAmount(
                        offer.consideration_type,
                        offer.amount_points,
                        offer.amount_cents,
                      )}{" "}
                      · {format(new Date(offer.start_time), "PPP p")}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold uppercase">{offer.status}</span>
                </div>
                {offer.status === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void respondToOffer(offer.id, true)}
                      disabled={respondingId === offer.id}
                      className="neu-border neu-press inline-flex items-center gap-2 bg-lime px-3 py-2 font-mono text-xs font-bold uppercase"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Accept & transfer
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondToOffer(offer.id, false)}
                      disabled={respondingId === offer.id}
                      className="neu-border neu-press inline-flex items-center gap-2 bg-white px-3 py-2 font-mono text-xs font-bold uppercase"
                    >
                      <X className="h-4 w-4" aria-hidden="true" /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoingOffers.length > 0 && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold uppercase">Your club&apos;s offers</h3>
          <div className="mt-3 space-y-2 font-mono text-xs">
            {outgoingOffers.map((offer) => (
              <div
                key={offer.id}
                className="neu-border flex flex-wrap justify-between gap-2 bg-white p-3"
              >
                <span>
                  {offer.item_name} → {offer.owner_club_name} ·{" "}
                  {formatBarterAmount(
                    offer.consideration_type,
                    offer.amount_points,
                    offer.amount_cents,
                  )}
                </span>
                <span className="font-bold uppercase">{offer.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bookings.length === 0 && incomingOffers.length === 0 && outgoingOffers.length === 0 && (
        <p className="mt-6 font-mono text-xs text-gray-700">
          No future barter opportunities or offers are available for this club.
        </p>
      )}

      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="barter-offer-title"
        >
          <div className="neu-border w-full max-w-md bg-white p-6 shadow-[8px_8px_0_0_var(--color-ink)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="barter-offer-title" className="font-display text-2xl font-bold">
                  Offer for {selectedBooking.item_name}
                </h3>
                <p className="mt-2 font-mono text-xs text-gray-700">
                  {selectedBooking.owner_club_name} currently holds this booking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                aria-label="Close offer dialog"
                className="neu-border p-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConsiderationType("points")}
                className={`neu-border inline-flex items-center justify-center gap-2 px-3 py-3 font-mono text-xs font-bold uppercase ${considerationType === "points" ? "bg-black text-white" : "bg-white"}`}
              >
                <Coins className="h-4 w-4" aria-hidden="true" /> Points
              </button>
              <button
                type="button"
                onClick={() => setConsiderationType("ledger")}
                className={`neu-border inline-flex items-center justify-center gap-2 px-3 py-3 font-mono text-xs font-bold uppercase ${considerationType === "ledger" ? "bg-black text-white" : "bg-white"}`}
              >
                <Banknote className="h-4 w-4" aria-hidden="true" /> Ledger USD
              </button>
            </div>

            <label
              htmlFor="barter-amount"
              className="mt-5 block font-mono text-xs font-bold uppercase"
            >
              {considerationType === "points" ? "Points offered" : "USD offered"}
            </label>
            <input
              id="barter-amount"
              type="number"
              min="0.01"
              step={considerationType === "points" ? "1" : "0.01"}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full border-2 border-black bg-cream p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-lime"
              placeholder={considerationType === "points" ? "500" : "10.00"}
            />

            <button
              type="button"
              onClick={() => void submitOffer()}
              disabled={isSubmitting || !amount}
              className="neu-border neu-press mt-6 inline-flex w-full items-center justify-center gap-2 bg-lime px-4 py-3 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {isSubmitting ? "Sending..." : "Send offer"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
