import React, { useState } from "react";
import { BlindAuctionGig, UnsealedAuctionResult } from "../../types/vendorBlindAuction";
import { vendorBlindAuctionService } from "../../services/vendorBlindAuctionService";

interface BlindAuctionOrganizerDashboardProps {
  auction: BlindAuctionGig;
  onAuctionUpdated?: (updated: BlindAuctionGig) => void;
}

export const BlindAuctionOrganizerDashboard: React.FC<BlindAuctionOrganizerDashboardProps> = ({
  auction: initialAuction,
  onAuctionUpdated,
}) => {
  const [auction, setAuction] = useState<BlindAuctionGig>(initialAuction);
  const [unsealedResult, setUnsealedResult] = useState<UnsealedAuctionResult | null>(null);
  const [isUnsealing, setIsUnsealing] = useState(false);
  const [awardedBidId, setAwardedBidId] = useState<string | null>(auction.awardedBidId || null);

  const handleBreakSeals = async () => {
    setIsUnsealing(true);
    try {
      const result = await vendorBlindAuctionService.breakSealsAndRevealBids(auction.id);
      setUnsealedResult(result);
      const updated = vendorBlindAuctionService.getAuctionById(auction.id);
      if (updated) {
        setAuction(updated);
        onAuctionUpdated?.(updated);
      }
    } catch (err) {
      console.error("Error unsealing bids:", err);
    } finally {
      setIsUnsealing(false);
    }
  };

  const handleAward = async (bidId: string) => {
    const updated = await vendorBlindAuctionService.awardGig(auction.id, bidId);
    setAuction(updated);
    setAwardedBidId(bidId);
    onAuctionUpdated?.(updated);
  };

  const isSealed = auction.status === "OPEN_SEALED";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">{auction.title}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isSealed
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {isSealed ? "🔒 Sealed Bidding Active" : "🔓 Seals Broken & Revealed"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Budget Cap: <strong className="text-foreground">${auction.maxBudget}</strong> |
            Category: <span className="font-semibold text-foreground">{auction.category}</span> |
            Total Bids: <strong className="text-foreground">{auction.totalBidsCount}</strong>
          </p>
        </div>

        {isSealed && (
          <button
            onClick={handleBreakSeals}
            disabled={isUnsealing || auction.totalBidsCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-primary px-5 py-2.5 text-sm font-bold text-white shadow hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isUnsealing ? "Breaking Cryptographic Seals..." : "🔓 Break Seals & Reveal All Bids"}
          </button>
        )}
      </div>

      {/* Sealed State View */}
      {isSealed ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3 bg-muted/20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 text-2xl">
            🛡️
          </div>
          <h3 className="text-base font-bold text-foreground">
            {auction.totalBidsCount} Sealed Bids Submitted
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All vendor bid amounts are cryptographically hashed and hidden at the database level to
            prevent undercutting wars. Once the deadline is reached, click &apos;Break Seals&apos;
            to unseal all submissions simultaneously.
          </p>
          <div className="text-xs font-mono text-muted-foreground pt-2">
            Deadline: {new Date(auction.biddingDeadline).toLocaleString()}
          </div>
        </div>
      ) : (
        /* Unsealed Ranked Bids Matrix */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Unsealed Bids Matrix (Sorted by Best Price)
            </h3>
            <span className="text-xs text-muted-foreground">
              Seals broken at {new Date(auction.sealsBrokenAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {unsealedResult?.bids.map((b) => (
              <div
                key={b.bidId}
                className={`rounded-xl border p-5 transition-all ${
                  awardedBidId === b.bidId
                    ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/30"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      #{b.rank}
                    </span>
                    <div>
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        {b.vendorName}
                        {b.rank === 1 && (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                            Lowest Price
                          </span>
                        )}
                        {b.bidId === unsealedResult.recommendedBestValueBidId && (
                          <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                            ⭐ Best Value Score
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{b.proposalDetails}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <div className="text-lg font-black text-foreground">${b.revealedAmount}</div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ${b.savingsBelowBudget} under budget
                      </div>
                    </div>

                    <button
                      onClick={() => handleAward(b.bidId)}
                      disabled={auction.status === "AWARDED"}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                        awardedBidId === b.bidId
                          ? "bg-emerald-600 text-white cursor-default"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {awardedBidId === b.bidId ? "✓ Contract Awarded" : "Award Contract"}
                    </button>
                  </div>
                </div>

                {b.deliverablesSummary.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                    {b.deliverablesSummary.map((d, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-foreground"
                      >
                        ✓ {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
