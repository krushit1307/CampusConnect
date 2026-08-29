import React, { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  MarketplaceFilterState,
  MarketplaceStats,
  TicketListing,
} from "@/types/ticketTransferMarketplace";
import { ticketTransferMarketplaceService } from "@/services/ticketTransferMarketplaceService";
import { MarketplaceAnalyticsHeader } from "./MarketplaceAnalyticsHeader";
import { CreateListingModal } from "./CreateListingModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Ticket,
  Search,
  Plus,
  ShieldCheck,
  ArrowRightLeft,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Award,
} from "lucide-react";

export const TicketMarketplaceCatalog: React.FC = () => {
  const [listings, setListings] = useState<TicketListing[]>([]);
  const [stats, setStats] = useState<MarketplaceStats>(
    ticketTransferMarketplaceService.getMarketplaceStats(),
  );
  const [filters, setFilters] = useState<MarketplaceFilterState>({
    listingType: "all",
    sortBy: "newest",
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [completedTransferListingId, setCompletedTransferListingId] = useState<
    string | null
  >(null);

  const refreshMarketplace = () => {
    const data = ticketTransferMarketplaceService.getListings(filters);
    setListings(data);
    setStats(ticketTransferMarketplaceService.getMarketplaceStats());
  };

  useEffect(() => {
    refreshMarketplace();

    const unsubscribe = ticketTransferMarketplaceService.subscribe(() => {
      refreshMarketplace();
    });

    return () => {
      unsubscribe();
    };
  }, [filters]);

  const handleExecuteTransfer = (listingId: string) => {
    const result = ticketTransferMarketplaceService.executeTicketTransfer(
      listingId,
      "user-rushabh",
      "Rushabh Mahajan",
    );

    if (result) {
      setCompletedTransferListingId(listingId);
      setTimeout(() => setCompletedTransferListingId(null), 3000);
      refreshMarketplace();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Campus Ticket Transfer Marketplace
                </h1>
                <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs border-0 shadow-md">
                  Anti-Scalping Guard Rails
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Safe peer-to-peer student ticket exchange with face-value price caps, instant QR transfer & verified trust ratings.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              ticketTransferMarketplaceService.resetToSample();
              refreshMarketplace();
            }}
            className="border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reset Demo
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg"
          >
            <Plus className="h-4 w-4 mr-1.5" /> List Ticket
          </Button>
        </div>
      </div>

      {/* Analytics Header */}
      <MarketplaceAnalyticsHeader stats={stats} />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search event, venue, or seller..."
            value={filters.searchQuery || ""}
            onChange={(e) =>
              setFilters({ ...filters, searchQuery: e.target.value })
            }
            className="pl-9 bg-slate-950 border-slate-800 text-xs text-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["all", "sell", "trade"].map((type) => (
            <button
              key={type}
              onClick={() => setFilters({ ...filters, listingType: type })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                filters.listingType === type
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {type === "all" ? "All Listings" : type === "sell" ? "For Sale" : "Trades Only"}
            </button>
          ))}

          <select
            value={filters.sortBy || "newest"}
            onChange={(e) =>
              setFilters({ ...filters, sortBy: e.target.value as any })
            }
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 font-semibold"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="price_low">Sort: Price Low to High</option>
            <option value="price_high">Sort: Price High to Low</option>
            <option value="trust_score">Sort: Highest Trust Score</option>
          </select>
        </div>
      </div>

      {/* Ticket Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
            <Ticket className="h-10 w-10 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-white">No Active Ticket Listings Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No tickets match your search filters. Click "List Ticket" to post the first ticket for this event!
            </p>
          </div>
        ) : (
          listings.map((listing) => {
            const isCompleted = listing.status === "completed";
            const isTrade = listing.listingType === "trade";
            const isJustTransferred = completedTransferListingId === listing.id;

            return (
              <m.div
                key={listing.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className={`relative overflow-hidden rounded-2xl border bg-slate-900/90 shadow-xl backdrop-blur-md flex flex-col justify-between transition-all ${
                  isJustTransferred
                    ? "border-emerald-500 ring-2 ring-emerald-500/40"
                    : "border-slate-800"
                }`}
              >
                {/* Banner Image */}
                <div className="relative h-40 w-full overflow-hidden bg-slate-950">
                  <img
                    src={listing.eventImageUrl}
                    alt={listing.eventTitle}
                    className="h-full w-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <Badge className="bg-slate-950/80 text-blue-400 border-slate-700 text-[10px] font-bold backdrop-blur-md">
                      {listing.ticketTier}
                    </Badge>

                    {isTrade ? (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-bold backdrop-blur-md flex items-center gap-1">
                        <ArrowRightLeft className="h-3 w-3" /> Trade Preferred
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold backdrop-blur-md flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" /> Anti-Scalp Capped
                      </Badge>
                    )}
                  </div>

                  {/* Price Tag Overlay */}
                  <div className="absolute bottom-3 left-3">
                    <div className="text-xs text-slate-300 font-medium">Asking Price</div>
                    <div className="text-2xl font-black text-white flex items-baseline gap-1.5">
                      ${(listing.askingPriceCents / 100).toFixed(2)}
                      {listing.askingPriceCents < listing.faceValueCents && (
                        <span className="text-xs font-semibold text-emerald-400 line-through">
                          ${(listing.faceValueCents / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Listing Details */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base tracking-tight leading-snug line-clamp-1">
                      {listing.eventTitle}
                    </h3>
                    <div className="mt-1 text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span>{new Date(listing.eventDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="truncate">{listing.venueName}</span>
                      </div>
                    </div>

                    {/* Trade Preference or Seller Note */}
                    {listing.tradePreferences && (
                      <p className="mt-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-300 font-medium">
                        "{listing.tradePreferences}"
                      </p>
                    )}
                    {listing.notes && !listing.tradePreferences && (
                      <p className="mt-2 text-xs text-slate-400 italic line-clamp-2">
                        "{listing.notes}"
                      </p>
                    )}
                  </div>

                  {/* Seller Trust Profile Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={listing.seller.sellerAvatar}
                        alt={listing.seller.sellerName}
                        className="h-8 w-8 rounded-full object-cover border border-blue-500/40"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                          {listing.seller.sellerName}
                          <CheckCircle2 className="h-3 w-3 text-blue-400" />
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Trust Score: <span className="text-emerald-400 font-bold">{listing.seller.trustScore}%</span> ({listing.seller.successfulTransfersCount} transfers)
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    {isCompleted ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-semibold py-1">
                        Transferred ✓
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleExecuteTransfer(listing.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 shadow-md"
                      >
                        {isTrade ? "Propose Trade" : "Get Ticket"}
                      </Button>
                    )}
                  </div>
                </div>
              </m.div>
            );
          })
        )}
      </div>

      {/* Create Listing Modal */}
      <CreateListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onListingCreated={refreshMarketplace}
      />
    </div>
  );
};
