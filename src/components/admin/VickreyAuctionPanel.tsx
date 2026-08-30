// src/components/admin/VickreyAuctionPanel.tsx
// Issue: #5056 - Dynamic "Resource Constraint" Auction Bid-Shielding Algorithm
// Description: Admin interface for managing sealed-bid second-price auctions

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Gavel,
  Clock,
  DollarSign,
  Users,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ResourceAuction {
  id: string;
  item_id: string;
  item_name: string;
  description: string;
  start_time: string;
  end_time: string;
  minimum_bid: number;
  status: string;
  winner_club_id: string | null;
  winning_bid: number | null;
  final_price: number | null;
  settlement_timestamp: string | null;
  created_at: string;
  club_name?: string;
  bid_count?: number;
}

interface AuctionBid {
  id: string;
  auction_id: string;
  club_id: string;
  club_name?: string;
  bidder_id: string;
  bidder_name?: string;
  maximum_bid: number;
  bid_timestamp: string;
  is_winning_bid: boolean;
  is_revealed: boolean;
}

export function VickreyAuctionPanel() {
  const supabase = createClient();
  const [auctions, setAuctions] = useState<ResourceAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuction, setSelectedAuction] = useState<ResourceAuction | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAuction, setNewAuction] = useState({
    item_id: "",
    duration_hours: 24,
    minimum_bid: 0,
  });

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("resource_auctions")
        .select(
          `
          *,
          clubs!inner(name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get bid counts for each auction
      const auctionsWithCounts = await Promise.all(
        (data || []).map(async (auction: any) => {
          const { count } = await supabase
            .from("auction_bids")
            .select("*", { count: "exact", head: true })
            .eq("auction_id", auction.id);

          return {
            ...auction,
            club_name: auction.clubs?.name,
            bid_count: count || 0,
          };
        }),
      );

      setAuctions(auctionsWithCounts);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch auctions");
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async (auctionId: string) => {
    try {
      const { data, error } = await supabase
        .from("auction_bids")
        .select(
          `
          *,
          clubs!inner(name),
          profiles!inner(first_name, last_name)
        `,
        )
        .eq("auction_id", auctionId)
        .order("maximum_bid", { ascending: false });

      if (error) throw error;

      const formattedBids = (data || []).map((bid: any) => ({
        ...bid,
        club_name: bid.clubs?.name,
        bidder_name: `${bid.profiles?.first_name} ${bid.profiles?.last_name}`,
      }));

      setBids(formattedBids);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch bids");
    }
  };

  const handleCreateAuction = async () => {
    try {
      const { data, error } = await supabase.rpc("create_resource_auction", {
        p_item_id: newAuction.item_id,
        p_duration_hours: newAuction.duration_hours,
        p_minimum_bid: newAuction.minimum_bid,
      });

      if (error) throw error;

      toast.success("Auction created successfully");
      setShowCreateModal(false);
      setNewAuction({ item_id: "", duration_hours: 24, minimum_bid: 0 });
      fetchAuctions();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to create auction");
    }
  };

  const handleSettleAuction = async (auctionId: string) => {
    try {
      const { data, error } = await supabase.rpc("settle_auction", {
        p_auction_id: auctionId,
      });

      if (error) throw error;

      toast.success("Auction settled successfully");
      fetchAuctions();
      if (selectedAuction?.id === auctionId) {
        fetchBids(auctionId);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to settle auction");
    }
  };

  const handleViewAuction = (auction: ResourceAuction) => {
    setSelectedAuction(auction);
    fetchBids(auction.id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
            Active
          </span>
        );
      case "settled":
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
            Settled
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  const getTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Ended";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display uppercase">Vickrey Auctions</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            Sealed-bid second-price auctions for resource allocation
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchAuctions} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Auction
          </Button>
        </div>
      </div>

      {auctions.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <Gavel className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="font-mono text-gray-600">No auctions created yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.map((auction) => (
            <div
              key={auction.id}
              className="border-2 border-gray-200 bg-white rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
              onClick={() => handleViewAuction(auction)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(auction.status)}
                    <span className="font-bold text-gray-900">{auction.item_name}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm font-mono text-gray-700 mb-2">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Min Bid: {auction.minimum_bid}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Bids: {auction.bid_count}
                    </span>
                    {auction.status === "active" && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimeRemaining(auction.end_time)}
                      </span>
                    )}
                  </div>

                  {auction.status === "settled" && auction.winner_club_id && (
                    <div className="flex items-center gap-2 text-sm font-mono text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Winner: {auction.club_name}</span>
                      <span>• Final Price: {auction.final_price}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {new Date(auction.start_time).toLocaleString()} -{" "}
                      {new Date(auction.end_time).toLocaleString()}
                    </span>
                  </div>
                </div>

                {auction.status === "active" && new Date(auction.end_time) <= new Date() && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSettleAuction(auction.id);
                    }}
                  >
                    Settle
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Auction Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold font-display uppercase mb-4">Create Auction</h3>
            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs uppercase font-bold text-gray-500">
                  Item ID
                </label>
                <Input
                  value={newAuction.item_id}
                  onChange={(e) => setNewAuction({ ...newAuction, item_id: e.target.value })}
                  placeholder="Enter inventory item UUID"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase font-bold text-gray-500">
                  Duration (hours)
                </label>
                <Input
                  type="number"
                  value={newAuction.duration_hours}
                  onChange={(e) =>
                    setNewAuction({ ...newAuction, duration_hours: parseInt(e.target.value) })
                  }
                  placeholder="24"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase font-bold text-gray-500">
                  Minimum Bid
                </label>
                <Input
                  type="number"
                  value={newAuction.minimum_bid}
                  onChange={(e) =>
                    setNewAuction({ ...newAuction, minimum_bid: parseInt(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button onClick={handleCreateAuction} className="flex-1">
                Create
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auction Detail Modal */}
      {selectedAuction && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedAuction(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold font-display uppercase">Auction Details</h3>
              <Button variant="ghost" onClick={() => setSelectedAuction(null)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">Item</span>
                <p className="font-bold">{selectedAuction.item_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Status
                  </span>
                  <p>{getStatusBadge(selectedAuction.status)}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Minimum Bid
                  </span>
                  <p className="font-bold">{selectedAuction.minimum_bid}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Start Time
                  </span>
                  <p>{new Date(selectedAuction.start_time).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    End Time
                  </span>
                  <p>{new Date(selectedAuction.end_time).toLocaleString()}</p>
                </div>
              </div>

              {selectedAuction.status === "settled" && (
                <div className="bg-green-50 p-4 rounded border border-green-200">
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Settlement Result
                  </span>
                  <div className="mt-2 space-y-1">
                    <p>Winner: {selectedAuction.club_name}</p>
                    <p>Winning Bid: {selectedAuction.winning_bid}</p>
                    <p>Final Price: {selectedAuction.final_price}</p>
                    <p>
                      Settled:{" "}
                      {selectedAuction.settlement_timestamp
                        ? new Date(selectedAuction.settlement_timestamp).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">Bids</span>
                {bids.length === 0 ? (
                  <p className="text-gray-600">No bids yet</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {bids.map((bid) => (
                      <div
                        key={bid.id}
                        className={`p-3 rounded border ${
                          bid.is_winning_bid
                            ? "bg-green-50 border-green-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold">{bid.club_name}</p>
                            <p className="text-xs text-gray-600">Bidder: {bid.bidder_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{bid.maximum_bid}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(bid.bid_timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {bid.is_winning_bid && (
                          <div className="mt-2 flex items-center gap-1 text-green-600 text-xs font-bold">
                            <CheckCircle className="w-3 h-3" />
                            Winning Bid
                          </div>
                        )}
                        {bid.is_revealed && !bid.is_winning_bid && (
                          <div className="mt-2 text-xs text-gray-500">
                            Revealed (Vickrey pricing applied)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
