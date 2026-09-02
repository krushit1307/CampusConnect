import React, { useState } from "react";
import { BlindAuctionGig, SealedVendorBid } from "../../types/vendorBlindAuction";
import { vendorBlindAuctionService } from "../../services/vendorBlindAuctionService";

interface BlindAuctionBidSubmissionModalProps {
  auction: BlindAuctionGig;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onBidSubmitted?: (bid: SealedVendorBid) => void;
}

export const BlindAuctionBidSubmissionModal: React.FC<BlindAuctionBidSubmissionModalProps> = ({
  auction,
  vendorId,
  vendorName,
  vendorEmail,
  isOpen,
  onClose,
  onBidSubmitted,
}) => {
  const [bidAmount, setBidAmount] = useState<string>("");
  const [proposalDetails, setProposalDetails] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBid, setSubmittedBid] = useState<SealedVendorBid | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const bid = await vendorBlindAuctionService.submitSealedBid({
        auctionId: auction.id,
        vendorId,
        vendorName,
        vendorEmail,
        bidAmount: amount,
        proposalDetails,
        deliverablesSummary: deliverables.split("\n").filter(Boolean),
      });

      setSubmittedBid(bid);
      onBidSubmitted?.(bid);
    } catch (err) {
      console.error("Error submitting sealed bid:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                🔒 Sealed-Bid Blind Auction
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">{auction.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {submittedBid ? (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-3xl">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-foreground">Bid Cryptographically Sealed!</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Your bid has been encrypted and hashed. No competing vendors or organizers can see
              your amount until the deadline passes.
            </p>
            <div className="rounded-lg bg-muted/60 p-3 text-left font-mono text-[11px] break-all">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Commitment Hash (SHA-256)
              </span>
              {submittedBid.commitmentHash}
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border border-border">
              💡 <strong>Fair Pricing Notice:</strong> In Blind Auction Mode, competing vendors
              cannot see your bid. Submit your true best price upfront without risk of retaliatory
              undercutting.
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Your Sealed Bid Amount ($){" "}
                <span className="text-muted-foreground">(Max Budget: ${auction.maxBudget})</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="1"
                  required
                  placeholder="e.g. 500"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background py-2 pl-7 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Proposal & Equipment Details
              </label>
              <textarea
                required
                rows={3}
                placeholder="Describe your equipment, setup timeline, and DJ experience..."
                value={proposalDetails}
                onChange={(e) => setProposalDetails(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Key Deliverables (one per line)
              </label>
              <textarea
                rows={2}
                placeholder="4 Hours Continuous Performance&#10;Subwoofers + Wireless Microphones&#10;Custom Playlist Matching Theme"
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? "Encrypting & Hashing..." : "🔒 Submit Sealed Bid"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
