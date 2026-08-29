import React, { useState, useEffect } from "react";
import {
  TicketResalePriceCapEngine,
  ResaleMarketplaceListing,
  ResaleSwapResult,
} from "@/services/ticketResalePriceCapEngine";
import { ListTicketResaleModal } from "./ListTicketResaleModal";
import {
  ShieldCheck,
  Tag,
  DollarSign,
  Ticket,
  UserCheck,
  CheckCircle,
  AlertCircle,
  CreditCard,
  PlusCircle,
  Clock,
  Sparkles,
} from "lucide-react";

interface TicketResalePriceCapMarketplaceProps {
  eventId?: string;
  eventTitle?: string;
  currentUserId?: string;
  currentUserName?: string;
}

export const TicketResalePriceCapMarketplace: React.FC<TicketResalePriceCapMarketplaceProps> = ({
  eventId = "evt-spring-concert-2026",
  eventTitle = "Annual Spring Campus Concert 2026",
  currentUserId = "user-current-student-01",
  currentUserName = "Alex Chen",
}) => {
  const [listings, setListings] = useState<ResaleMarketplaceListing[]>([]);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [selectedListingForBuy, setSelectedListingForBuy] =
    useState<ResaleMarketplaceListing | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [swapSuccessResult, setSwapSuccessResult] = useState<ResaleSwapResult | null>(null);

  useEffect(() => {
    // Seed sample verified listings if empty
    const existing = TicketResalePriceCapEngine.getAvailableListings(eventId);
    if (existing.length === 0) {
      TicketResalePriceCapEngine.listTicketForResale({
        ticketId: "tkt-seed-01",
        eventId,
        eventTitle,
        sellerUserId: "user-seller-sarah",
        sellerName: "Sarah Connor",
        originalPrice: 30.0,
        resalePrice: 30.0,
        tierName: "VIP Stage Front",
      });
      TicketResalePriceCapEngine.listTicketForResale({
        ticketId: "tkt-seed-02",
        eventId,
        eventTitle,
        sellerUserId: "user-seller-dave",
        sellerName: "Dave Bowman",
        originalPrice: 20.0,
        resalePrice: 18.5,
        tierName: "General Admission",
      });
    }
    setListings(TicketResalePriceCapEngine.getAvailableListings(eventId));
  }, [eventId, eventTitle]);

  const handleBuy = (listing: ResaleMarketplaceListing) => {
    setSelectedListingForBuy(listing);
  };

  const handleConfirmPurchase = () => {
    if (!selectedListingForBuy) return;
    setIsBuying(true);

    try {
      // Step 1: Lock in escrow
      TicketResalePriceCapEngine.lockForEscrow(selectedListingForBuy.id, currentUserId);

      // Step 2: Atomic Swap & Stripe payout
      const swapResult = TicketResalePriceCapEngine.executeAtomicTicketSwap(
        selectedListingForBuy.id,
        currentUserId,
      );

      setSwapSuccessResult(swapResult);
      setListings(TicketResalePriceCapEngine.getAvailableListings(eventId));
      setSelectedListingForBuy(null);
    } catch (err) {
      console.error("Purchase failed:", err);
    } finally {
      setIsBuying(false);
    }
  };

  const handleListingCreated = (newListing: ResaleMarketplaceListing) => {
    setListings((prev) => [newListing, ...prev]);
  };

  return (
    <div className="w-full space-y-6">
      {/* Marketplace Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-200" />
            Verified Face-Value Resale Marketplace
          </div>
          <h2 className="text-2xl font-extrabold">{eventTitle}</h2>
          <p className="text-xs text-emerald-100 max-w-xl">
            100% price-cap protected. Every ticket is cryptographically re-minted upon purchase.
          </p>
        </div>

        <button
          onClick={() => setIsListModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-emerald-800 font-bold text-xs shadow-md hover:bg-emerald-50 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          List Your Ticket
        </button>
      </div>

      {/* Success Swap Toast / Box */}
      {swapSuccessResult && (
        <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-sm">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Ticket Purchased & Atomic Swap Complete!
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div>New Ticket ID: {swapSuccessResult.newTicketId.slice(0, 16)}...</div>
            <div>Secure Barcode Token: {swapSuccessResult.newBarcodeToken}</div>
            <div>Settled: ${swapSuccessResult.payoutAmount.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <span>Available Verified Listings ({listings.length})</span>
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 0% Scalper Markup Guaranteed
          </span>
        </div>

        {listings.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
            No tickets listed for resale right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map((listing) => {
              const isSeller = listing.sellerUserId === currentUserId;
              const hasDiscount = listing.resalePrice < listing.originalPrice;

              return (
                <div
                  key={listing.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                        {listing.tierName}
                      </span>
                      {hasDiscount ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                          Below Face Value 🔥
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          Face Value Cap
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        ${listing.resalePrice.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        Original: ${listing.originalPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 mb-3">
                      <div>Seller: {listing.sellerName}</div>
                      <div>Seat: {listing.seatIdentifier}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Instant Escrow Swap
                    </div>

                    {isSeller ? (
                      <span className="text-xs font-bold text-slate-400">Your Listing</span>
                    ) : (
                      <button
                        onClick={() => handleBuy(listing)}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
                      >
                        Buy Ticket
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Buy Confirmation Modal */}
      {selectedListingForBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Confirm Resale Purchase
            </h3>

            <p className="text-xs text-slate-500">
              You are purchasing 1 ticket ({selectedListingForBuy.tierName}) for{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                ${selectedListingForBuy.resalePrice.toFixed(2)}
              </span>
              .
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500 text-left space-y-1">
              <div className="flex justify-between">
                <span>Anti-Scalping Fee:</span>
                <span className="font-bold text-emerald-600">$0.00</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>Total Charge:</span>
                <span>${selectedListingForBuy.resalePrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedListingForBuy(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBuying}
                onClick={handleConfirmPurchase}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md"
              >
                {isBuying ? "Processing..." : "Pay with Stripe"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Modal */}
      <ListTicketResaleModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        ticketId="tkt-user-01"
        eventId={eventId}
        eventTitle={eventTitle}
        originalPrice={25.0}
        tierName="General Admission"
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onListingCreated={handleListingCreated}
      />
    </div>
  );
};
