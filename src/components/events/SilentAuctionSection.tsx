import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Clock, Gavel, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  fetchEventAuctionItems,
  fetchUserAuctionWinners,
  formatAuctionCents,
  formatAuctionTimeRemaining,
  placeSilentAuctionBid,
  type AuctionItem,
  type AuctionItemUpdate,
} from "@/lib/silentAuction";

interface SilentAuctionSectionProps {
  eventId: string;
  eventEndDate?: string | null;
  userId?: string;
  isOrganizer?: boolean;
}

function toDateTimeLocal(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultAuctionEnd(eventEndDate?: string | null): string {
  if (eventEndDate && new Date(eventEndDate).getTime() > Date.now()) {
    return toDateTimeLocal(eventEndDate);
  }
  return toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000));
}

function liveItemsCount(items: AuctionItem[], updates: Record<string, AuctionItemUpdate>): number {
  return items.filter((item) => updates[item.id]?.is_closed ?? item.is_closed).length;
}

export function SilentAuctionSection({
  eventId,
  eventEndDate,
  userId,
  isOrganizer = false,
}: SilentAuctionSectionProps) {
  const [supabase] = useState(() => createClient());
  const [now, setNow] = useState(() => new Date());
  const [liveUpdates, setLiveUpdates] = useState<Record<string, AuctionItemUpdate>>({});
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartingBid, setNewStartingBid] = useState("25");
  const [newEndTime, setNewEndTime] = useState(() => defaultAuctionEnd(eventEndDate));
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery<AuctionItem[]>({
    queryKey: ["silent-auction-items", eventId],
    queryFn: () => fetchEventAuctionItems(supabase, eventId),
    enabled: Boolean(eventId),
  });

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const closedItemCount = liveItemsCount(items, liveUpdates);
  const { data: winners = [] } = useQuery({
    queryKey: ["silent-auction-winners", eventId, userId, closedItemCount],
    queryFn: () => fetchUserAuctionWinners(supabase, userId!, itemIds),
    enabled: Boolean(userId && itemIds.length > 0),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`auction-item-updates:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auction_item_updates",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const update = payload.new as AuctionItemUpdate;
          setLiveUpdates((current) => ({ ...current, [update.item_id]: update }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  const liveItems = useMemo(
    () => items.map((item) => ({ ...item, ...(liveUpdates[item.id] ?? {}) })),
    [items, liveUpdates],
  );
  const winnersByItem = useMemo(
    () => new Map(winners.map((winner) => [winner.item_id, winner])),
    [winners],
  );

  const handleBid = async (item: AuctionItem) => {
    if (!userId) {
      toast.error("Please sign in to place a bid.");
      return;
    }

    const liveItem = liveItems.find((candidate) => candidate.id === item.id) ?? item;
    const minimumBidCents = Math.max(
      liveItem.starting_bid,
      liveItem.current_highest_bid + liveItem.bid_increment_cents,
    );
    const input = bidInputs[item.id];
    const amountCents = input ? Math.round(Number(input) * 100) : minimumBidCents;

    if (!Number.isFinite(amountCents) || amountCents < minimumBidCents) {
      toast.error(`Your bid must be at least ${formatAuctionCents(minimumBidCents)}.`);
      return;
    }

    setSubmittingItemId(item.id);
    const result = await placeSilentAuctionBid(item.id, userId, amountCents);
    setSubmittingItemId(null);

    if (!result.success) {
      toast.error(result.message);
      await refetch();
      return;
    }

    setLiveUpdates((current) => ({
      ...current,
      [item.id]: {
        item_id: item.id,
        event_id: eventId,
        current_highest_bid: result.newHighestBid,
        end_time: result.newEndTime ?? liveItem.end_time,
        is_closed: false,
      },
    }));
    setBidInputs((current) => ({ ...current, [item.id]: "" }));
    toast.success(
      result.extendedByAntiSniping
        ? "Bid placed. The closing timer was extended by five minutes."
        : "Bid placed successfully.",
    );
  };

  const handleCreateItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim() || !userId) {
      toast.error(!userId ? "Please sign in as the event organizer." : "Enter an item name.");
      return;
    }

    const startingBidCents = Math.round(Number(newStartingBid) * 100);
    const endTime = new Date(newEndTime);
    if (
      !Number.isFinite(startingBidCents) ||
      startingBidCents <= 0 ||
      endTime.getTime() <= Date.now()
    ) {
      toast.error("Enter a valid starting bid and future closing time.");
      return;
    }

    setIsCreating(true);
    const { error } = await supabase.from("auction_items").insert({
      event_id: eventId,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      starting_bid: startingBidCents,
      current_highest_bid: 0,
      bid_increment_cents: 100,
      end_time: endTime.toISOString(),
    });
    setIsCreating(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setNewTitle("");
    setNewDescription("");
    setNewStartingBid("25");
    setNewEndTime(defaultAuctionEnd(eventEndDate));
    toast.success("Auction item added.");
    await refetch();
  };

  if (isLoading && !isOrganizer) return null;
  if (!isLoading && liveItems.length === 0 && !isOrganizer) return null;

  return (
    <section
      className="mt-10 border-t-2 border-black pt-8"
      aria-labelledby="silent-auction-heading"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="neu-border shrink-0 bg-lime p-2 text-black">
          <Gavel className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2
            id="silent-auction-heading"
            className="font-display text-2xl font-black uppercase tracking-tight"
          >
            Silent Auction
          </h2>
          <p className="mt-1 max-w-2xl font-mono text-xs text-black/65">
            Bid from your phone while the current highest bid and closing timer update live for
            everyone.
          </p>
        </div>
      </div>

      {liveItems.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {liveItems.map((item) => {
            const timer = formatAuctionTimeRemaining(item.end_time, now);
            const isClosed = item.is_closed || timer.isClosed;
            const minimumBidCents = Math.max(
              item.starting_bid,
              item.current_highest_bid + item.bid_increment_cents,
            );
            const isSubmitting = submittingItemId === item.id;
            const winner = winnersByItem.get(item.id);

            return (
              <article
                key={item.id}
                className="neu-border bg-white p-5"
                aria-label={`Silent auction item: ${item.title}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold uppercase">{item.title}</h3>
                    {item.description && (
                      <p className="mt-1 font-mono text-xs text-black/65">{item.description}</p>
                    )}
                  </div>
                  <span
                    className={`neu-border shrink-0 px-2 py-1 font-mono text-[10px] font-bold uppercase ${isClosed ? "bg-gray-200" : "bg-cream"}`}
                  >
                    {isClosed ? "Closed" : "Live"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="neu-border bg-amber-50 p-3">
                    <p className="font-mono text-[10px] font-bold uppercase text-black/60">
                      Current highest bid
                    </p>
                    <p className="mt-1 font-display text-2xl font-black">
                      {formatAuctionCents(item.current_highest_bid)}
                    </p>
                  </div>
                  <div className="neu-border bg-sky-50 p-3">
                    <p className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-black/60">
                      <Clock className="h-3 w-3" aria-hidden="true" /> Time remaining
                    </p>
                    <p className="mt-1 font-mono text-sm font-black" aria-live="polite">
                      {timer.label}
                    </p>
                  </div>
                </div>

                {winner?.payment_status === "paid" && (
                  <p className="neu-border mt-4 bg-lime p-3 font-mono text-xs font-bold uppercase">
                    Payment received — you won this item.
                  </p>
                )}
                {winner?.payment_status === "pending" && winner.stripe_checkout_url && (
                  <a
                    href={winner.stripe_checkout_url}
                    className="neu-border neu-press mt-4 inline-flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream"
                  >
                    <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                    Pay winning bid
                  </a>
                )}

                {!isClosed && (
                  <div className="mt-4">
                    <label
                      htmlFor={`auction-bid-${item.id}`}
                      className="mb-1 block font-mono text-[10px] font-bold uppercase text-black/60"
                    >
                      Your bid, USD
                    </label>
                    <div className="flex gap-2">
                      <div className="neu-border flex min-w-0 flex-1 items-center bg-white px-3">
                        <span className="font-mono text-sm font-bold text-black/60">$</span>
                        <input
                          id={`auction-bid-${item.id}`}
                          type="number"
                          min={minimumBidCents / 100}
                          step="0.01"
                          value={bidInputs[item.id] ?? (minimumBidCents / 100).toFixed(2)}
                          onChange={(event) =>
                            setBidInputs((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="w-full bg-transparent px-2 py-2 font-mono text-sm font-bold outline-none"
                          disabled={isSubmitting}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleBid(item)}
                        disabled={isSubmitting}
                        className="neu-border neu-press bg-lime px-4 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-label="Submitting bid" />
                        ) : (
                          "Bid"
                        )}
                      </button>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-black/55">
                      Minimum next bid: {formatAuctionCents(minimumBidCents)}
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {isOrganizer && (
        <form onSubmit={handleCreateItem} className="neu-border mt-6 bg-cream p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add auction item
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="auction-new-title"
                className="mb-1 block font-mono text-[10px] font-bold uppercase"
              >
                Item name
              </label>
              <input
                id="auction-new-title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                className="neu-border w-full bg-white px-3 py-2 font-mono text-sm"
                placeholder="Signed jersey"
              />
            </div>
            <div>
              <label
                htmlFor="auction-new-starting-bid"
                className="mb-1 block font-mono text-[10px] font-bold uppercase"
              >
                Starting bid, USD
              </label>
              <input
                id="auction-new-starting-bid"
                type="number"
                min="0.01"
                step="0.01"
                value={newStartingBid}
                onChange={(event) => setNewStartingBid(event.target.value)}
                className="neu-border w-full bg-white px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="auction-new-end-time"
                className="mb-1 block font-mono text-[10px] font-bold uppercase"
              >
                Closes at
              </label>
              <input
                id="auction-new-end-time"
                type="datetime-local"
                value={newEndTime}
                onChange={(event) => setNewEndTime(event.target.value)}
                className="neu-border w-full bg-white px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="auction-new-description"
                className="mb-1 block font-mono text-[10px] font-bold uppercase"
              >
                Description, optional
              </label>
              <input
                id="auction-new-description"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                className="neu-border w-full bg-white px-3 py-2 font-mono text-sm"
                placeholder="Framed and signed"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="neu-border neu-press mt-4 inline-flex items-center gap-2 bg-black px-4 py-2 font-mono text-xs font-bold uppercase text-cream disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-label="Adding item" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Add item
          </button>
        </form>
      )}
    </section>
  );
}
