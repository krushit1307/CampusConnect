import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Bid {
  id: string;
  sponsor_name: string;
  amount: number;
  created_at: string;
}

export default function AuctionBiddingCard({
  auctionId,
  placementType,
  initialHighestBid,
}: {
  auctionId: string;
  placementType: string;
  initialHighestBid: number;
}) {
  const [highestBid, setHighestBid] = useState<number>(initialHighestBid);
  const [topBidder, setTopBidder] = useState<string>("No bids yet");
  const [bidIncrement, setBidIncrement] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // 1. Fetch current leading bid configuration on mount
    const fetchLatestBid = async () => {
      const { data } = await supabase
        .from("bids")
        .select("amount, sponsor_name")
        .eq("auction_id", auctionId)
        .order("amount", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setHighestBid(Number(data.amount));
        setTopBidder(data.sponsor_name);
      }
    };

    fetchLatestBid();

    // 2. Subscribe to real-time additions to the 'bids' table for this auction
    const bidSubscription = supabase
      .channel(`auction:${auctionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` },
        (payload) => {
          const newBid = payload.new as Bid;
          setHighestBid(Number(newBid.amount));
          setTopBidder(newBid.sponsor_name);
          setErrorMessage(""); // Reset validation alerts on new live updates
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bidSubscription);
    };
  }, [auctionId]);

  const handlePlaceBid = async () => {
    setLoading(true);
    setErrorMessage("");
    const nextBidAmount = highestBid + bidIncrement;

    try {
      const { error } = await supabase.rpc("place_live_bid", {
        target_auction_id: auctionId,
        sponsor_bid_amount: nextBidAmount,
        sponsor_company_name: "Acme Corp", // Dynamically mapped from active auth context profile
      });

      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit bid. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 capitalize mb-1">
        {placementType.replace("_", " ")}
      </h2>
      <p className="text-sm text-gray-500 mb-4">Live Real-Time Sponsorship Auction</p>

      <div className="bg-amber-50 p-4 rounded-lg mb-4 text-center border border-amber-200">
        <span className="block text-xs uppercase tracking-wider text-amber-700 font-semibold">
          Current Highest Bid
        </span>
        <span className="text-3xl font-extrabold text-amber-900">
          ${highestBid.toLocaleString()}
        </span>
        <span className="block text-xs text-amber-600 mt-1">
          Held by: <strong>{topBidder}</strong>
        </span>
      </div>

      {errorMessage && <p className="text-xs text-red-600 mb-2 font-medium">⚠️ {errorMessage}</p>}

      <button
        onClick={handlePlaceBid}
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition dynamic-fomo-button disabled:opacity-50"
      >
        {loading ? "Processing Bid..." : `Bid $${(highestBid + bidIncrement).toLocaleString()}`}
      </button>
    </div>
  );
}
