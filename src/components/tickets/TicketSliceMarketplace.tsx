import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  SliceAuction,
  SliceMarketListing,
  TicketSliceService,
  UserSliceView,
} from "@/services/ticketSliceService";
import { useAuthStore } from "@/store/useAuthStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Timer,
  Ticket,
  Clock,
  TrendingDown,
  Wallet,
  Loader2,
  Zap,
  CheckCircle2,
  X,
} from "lucide-react";

const USD = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function formatWindow(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  return `${s.toLocaleString(undefined, opts)} – ${e.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function livePrice(auction: SliceAuction): number {
  return TicketSliceService.calculateLivePrice(auction, new Date());
}

/**
 * Fractional Ticket Marketplace (#5375).
 *
 * Lets ticket holders split their ticket into time slices and list them on a
 * Dutch-auction secondary market. Buyers see a live decaying price (client-side
 * clock mirror + realtime row updates) and purchase at the current price.
 */
export const TicketSliceMarketplace: React.FC<{ eventId: string }> = ({ eventId }) => {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";

  const [listings, setListings] = useState<SliceMarketListing[]>([]);
  const [mySlices, setMySlices] = useState<UserSliceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const [listSlice, setListSlice] = useState<UserSliceView | null>(null);
  const [startPrice, setStartPrice] = useState(5000);
  const [minPrice, setMinPrice] = useState(1000);

  const [buyingAuctionId, setBuyingAuctionId] = useState<string | null>(null);
  const [buyMaxPrice, setBuyMaxPrice] = useState(0);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const [ls, ms] = await Promise.all([
      TicketSliceService.getActiveSliceAuctions(eventId),
      userId ? TicketSliceService.getMySlices(userId) : Promise.resolve([]),
    ]);
    setListings(ls);
    setMySlices(ms);
    setLoading(false);
  }, [eventId, userId]);

  useEffect(() => {
    refresh();
    const ticker = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(ticker);
  }, [refresh]);

  // Realtime: reflect purchases/listing changes instantly.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`slice-market-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ticket_slice_auctions",
          filter: `event_id=eq.${eventId}`,
        },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ticket_slices",
          filter: `event_id=eq.${eventId}`,
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, refresh]);

  const myAvailableSlices = useMemo(
    () => mySlices.filter((s) => s.status === "available"),
    [mySlices],
  );

  const handleList = async () => {
    if (!listSlice || !userId) return;
    if (startPrice < 0 || minPrice < 0 || startPrice < minPrice) {
      setToast({ kind: "err", text: "Start price must be >= min price." });
      return;
    }
    const res = await TicketSliceService.listSliceAuction({
      sliceId: listSlice.slice_id,
      sellerId: userId,
      startPriceCents: startPrice,
      minPriceCents: minPrice,
    });
    if (res.success) {
      setToast({ kind: "ok", text: "Slice listed on the secondary market." });
      setListSlice(null);
    } else {
      setToast({ kind: "err", text: res.error ?? "Failed to list slice." });
    }
    refresh();
  };

  const handleBuy = async (auction: SliceMarketListing) => {
    if (!userId) return;
    setBuyingAuctionId(auction.id);
    const max = buyMaxPrice > 0 ? buyMaxPrice : livePrice(auction);
    const res = await TicketSliceService.purchaseSlice(auction.id, userId, max);
    setBuyingAuctionId(null);
    if (res.success) {
      setToast({ kind: "ok", text: `Slice purchased for ${USD(res.pricePaidCents ?? max)}.` });
    } else {
      setToast({ kind: "err", text: res.error ?? "Purchase failed." });
    }
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Ticket className="h-5 w-5 text-indigo-500" />
            Fractional Ticket Marketplace
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Split your ticket into time slices and sell the hours you won&apos;t use — or grab a
            slice of an event you only want to attend partly. Prices drop in real time.
          </p>
        </div>
      </div>

      {toast && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            toast.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
          }`}
          role="status"
        >
          <span className="flex items-center gap-2">
            {toast.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {toast.text}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Wallet: my slices */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Wallet className="h-4 w-4 text-emerald-500" /> My Ticket Slices
        </h3>
        {mySlices.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No fractional slices yet. Buy a full ticket, then fractionalize it from your RSVPs to
            sell the hours you won&apos;t use.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mySlices.map((s) => (
              <div
                key={s.slice_id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="mb-1 flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className={
                      s.status === "available"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        : s.status === "listed"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }
                  >
                    {s.status}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {s.sold_price_cents != null ? USD(s.sold_price_cents) : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatWindow(s.slice_start, s.slice_end)}
                </p>
                {s.status === "available" && (
                  <Button size="sm" className="mt-3 w-full" onClick={() => setListSlice(s)}>
                    <TrendingDown className="mr-1 h-4 w-4" /> List for auction
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Secondary market: active slice auctions */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Zap className="h-4 w-4 text-amber-500" /> Live Secondary Market
          <Badge variant="outline" className="ml-auto">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : `${listings.length} active`}
          </Badge>
        </h3>

        {!loading && listings.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No fractional slices are listed for this event yet. Be the first to sell your unused
            hours.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const price = livePrice(l);
              const sold = l.slice?.status === "sold";
              return (
                <div
                  key={l.id}
                  className={`rounded-lg border p-4 transition ${
                    sold
                      ? "border-slate-200 opacity-60 dark:border-slate-700"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="secondary">Slice</Badge>
                    {sold ? (
                      <Badge variant="outline" className="text-emerald-600">
                        Sold
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                        <Timer className="mr-1 h-3 w-3" /> Live
                      </Badge>
                    )}
                  </div>
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatWindow(l.slice_start ?? l.ends_at, l.slice_end ?? l.ends_at)}
                  </p>
                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">{USD(price)}</span>
                    <span className="text-xs text-slate-400 line-through">
                      {USD(l.start_price_cents)}
                    </span>
                  </div>
                  {sold ? (
                    <Button size="sm" disabled className="w-full">
                      Purchased
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Max price ($)"
                        aria-label="Maximum price in dollars"
                        className="h-9"
                        onChange={(e) =>
                          setBuyMaxPrice(Math.round(Number(e.target.value || "0") * 100))
                        }
                      />
                      <Button
                        size="sm"
                        className="whitespace-nowrap"
                        disabled={buyingAuctionId === l.id}
                        onClick={() => handleBuy(l)}
                      >
                        {buyingAuctionId === l.id ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Clock className="mr-1 h-4 w-4" />
                        )}
                        Buy
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* List slice modal */}
      {listSlice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="List slice for auction"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">List slice for auction</h3>
              <button
                type="button"
                onClick={() => setListSlice(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {listSlice.event_title} — {formatWindow(listSlice.slice_start, listSlice.slice_end)}
            </p>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  Starting price ($)
                </span>
                <Input
                  type="number"
                  min={0}
                  value={startPrice / 100}
                  onChange={(e) => setStartPrice(Math.round(Number(e.target.value || "0") * 100))}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  Minimum price ($)
                </span>
                <Input
                  type="number"
                  min={0}
                  value={minPrice / 100}
                  onChange={(e) => setMinPrice(Math.round(Number(e.target.value || "0") * 100))}
                />
              </label>
              <p className="text-xs text-slate-400">
                The price drops every 60s from start to minimum until the slice&apos;s entry window
                begins.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setListSlice(null)}>
                Cancel
              </Button>
              <Button onClick={handleList}>
                <TrendingDown className="mr-1 h-4 w-4" /> List slice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
