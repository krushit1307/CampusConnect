export type BlindAuctionStatus = "OPEN_SEALED" | "SEALS_BROKEN" | "AWARDED" | "CANCELLED";

export type ServiceCategory =
  "DJ" | "CATERING" | "PHOTOGRAPHY" | "SECURITY" | "AV_LIGHTING" | "DECOR" | "OTHER";

export interface BlindAuctionGig {
  id: string;
  organizerId: string;
  organizerName: string;
  eventId: string;
  eventName: string;
  title: string;
  description: string;
  category: ServiceCategory;
  maxBudget: number;
  isBlindAuction: boolean;
  biddingDeadline: string; // ISO string when seals are broken
  status: BlindAuctionStatus;
  sealsBrokenAt?: string | null;
  awardedBidId?: string | null;
  awardedVendorId?: string | null;
  totalBidsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SealedVendorBid {
  id: string;
  auctionId: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  vendorRating?: number;
  // Sealed state properties
  commitmentHash: string; // SHA-256 cryptographic hash of (bidAmount + salt + vendorId)
  encryptedAmountPayload: string;
  isSealed: boolean;
  submittedAt: string;
  // Revealed state properties (null until seals are broken)
  revealedBidAmount?: number | null;
  proposalDetails?: string | null;
  deliverablesSummary?: string[] | null;
  unsealedAt?: string | null;
  rank?: number;
  score?: number;
}

export interface SubmitSealedBidInput {
  auctionId: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  bidAmount: number;
  salt?: string;
  proposalDetails: string;
  deliverablesSummary?: string[];
  vendorRating?: number;
}

export interface CreateBlindAuctionInput {
  organizerId: string;
  organizerName: string;
  eventId: string;
  eventName: string;
  title: string;
  description: string;
  category: ServiceCategory;
  maxBudget: number;
  biddingDeadline: string;
}

export interface UnsealedAuctionResult {
  auctionId: string;
  title: string;
  maxBudget: number;
  biddingDeadline: string;
  sealsBrokenAt: string;
  totalBids: number;
  bids: Array<{
    bidId: string;
    vendorId: string;
    vendorName: string;
    revealedAmount: number;
    savingsBelowBudget: number;
    proposalDetails: string;
    deliverablesSummary: string[];
    isWithinBudget: boolean;
    rank: number;
    valueScore: number;
  }>;
  recommendedLowestBidId?: string;
  recommendedBestValueBidId?: string;
}

export interface BlindAuctionViewMode {
  viewerRole: "ORGANIZER" | "BIDDING_VENDOR" | "COMPETING_VENDOR" | "PUBLIC";
  viewerVendorId?: string;
}
