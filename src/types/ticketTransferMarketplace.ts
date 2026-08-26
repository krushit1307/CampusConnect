// ─── Dynamic Event Ticket Transfer Marketplace Types ────────────────────

export type ListingType = "sell" | "trade" | "buy_request";

export type ListingStatus =
  | "active"
  | "pending_transfer"
  | "completed"
  | "cancelled";

export type TicketTierName = "General Admission" | "VIP Access" | "Early Bird" | "Student Floor";

export interface SellerTrustInfo {
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  isVerifiedStudent: boolean;
  accountAgeDays: number;
  successfulTransfersCount: number;
  noShowRate: number; // e.g. 0.00
  trustScore: number; // 0 - 100
}

export interface TicketListing {
  id: string; // e.g. "MKT-LST-8801"
  eventId: string;
  eventTitle: string;
  eventDate: Date;
  venueName: string;
  eventImageUrl: string;
  
  ticketId: string;
  ticketTier: TicketTierName;
  faceValueCents: number;
  askingPriceCents: number;
  maxAllowedPriceCents: number;
  
  listingType: ListingType;
  tradePreferences?: string; // e.g., "Will trade for Friday night VIP pass"
  
  seller: SellerTrustInfo;
  status: ListingStatus;
  listedAt: Date;
  completedAt?: Date;
  buyerId?: string;
  buyerName?: string;
  
  notes?: string;
}

export interface MarketplaceFilterState {
  eventId?: string;
  listingType?: string; // 'all' | 'sell' | 'trade' | 'buy_request'
  maxPriceCents?: number;
  ticketTier?: string;
  searchQuery?: string;
  sortBy?: "newest" | "price_low" | "price_high" | "trust_score";
}

export interface MarketplaceStats {
  totalActiveListings: number;
  avgResalePriceCents: number;
  avgFaceValueCents: number;
  demandIndex: number; // Buyers per seller ratio, e.g. 3.4x
  totalVolumeTransferredCents: number;
  totalTransfersCompleted: number;
}
