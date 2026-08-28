import {
  ListingStatus,
  MarketplaceFilterState,
  MarketplaceStats,
  SellerTrustInfo,
  TicketListing,
} from "@/types/ticketTransferMarketplace";
import { ticketResaleService } from "./ticketResaleService";

// ─── Default Sample Marketplace Listings ──────────────────────────────────

const SAMPLE_SELLERS: SellerTrustInfo[] = [
  {
    sellerId: "user-seller-1",
    sellerName: "Maya Lin",
    sellerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    isVerifiedStudent: true,
    accountAgeDays: 450,
    successfulTransfersCount: 8,
    noShowRate: 0.0,
    trustScore: 98,
  },
  {
    sellerId: "user-seller-2",
    sellerName: "Ethan Vance",
    sellerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    isVerifiedStudent: true,
    accountAgeDays: 320,
    successfulTransfersCount: 4,
    noShowRate: 0.0,
    trustScore: 94,
  },
  {
    sellerId: "user-seller-3",
    sellerName: "Priya Patel",
    sellerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    isVerifiedStudent: true,
    accountAgeDays: 610,
    successfulTransfersCount: 15,
    noShowRate: 0.0,
    trustScore: 99,
  },
];

const INITIAL_LISTINGS: TicketListing[] = [
  {
    id: "MKT-LST-101",
    eventId: "evt-music-fest-2026",
    eventTitle: "Spring Campus Music Fest 2026",
    eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days away
    venueName: "Main Campus Amphitheater",
    eventImageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80",
    ticketId: "tkt-mf-01",
    ticketTier: "VIP Access",
    faceValueCents: 4500, // $45.00
    askingPriceCents: 4500, // $45.00 (Face Value Capped)
    maxAllowedPriceCents: 4500,
    listingType: "sell",
    seller: SAMPLE_SELLERS[0],
    status: "active",
    listedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    notes: "Cannot attend due to midterm exam. Instant transfer upon payment!",
  },
  {
    id: "MKT-LST-102",
    eventId: "evt-gala-2026",
    eventTitle: "Annual Engineering Charity Gala",
    eventDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
    venueName: "Grand Ballroom, Student Union",
    eventImageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&auto=format&fit=crop&q=80",
    ticketId: "tkt-gl-02",
    ticketTier: "Student Floor",
    faceValueCents: 3000, // $30.00
    askingPriceCents: 2500, // $25.00 ($5 discount)
    maxAllowedPriceCents: 3000,
    listingType: "sell",
    seller: SAMPLE_SELLERS[1],
    status: "active",
    listedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    notes: "Selling below face value. Includes dinner coupon.",
  },
  {
    id: "MKT-LST-103",
    eventId: "evt-rivalry-game",
    eventTitle: "Big Rivalry Basketball Game vs State",
    eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    venueName: "Campus Sports Arena",
    eventImageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&auto=format&fit=crop&q=80",
    ticketId: "tkt-bb-03",
    ticketTier: "General Admission",
    faceValueCents: 2000, // $20.00
    askingPriceCents: 2000,
    maxAllowedPriceCents: 2000,
    listingType: "trade",
    tradePreferences: "Looking to trade for Saturday Night Dance Pass",
    seller: SAMPLE_SELLERS[2],
    status: "active",
    listedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    notes: "Direct trade preferred. Verified student badge only.",
  },
];

class TicketTransferMarketplaceService {
  private listings: TicketListing[] = [...INITIAL_LISTINGS];
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getListings(filters?: MarketplaceFilterState): TicketListing[] {
    let result = [...this.listings];

    if (!filters) return result;

    if (filters.eventId) {
      result = result.filter((l) => l.eventId === filters.eventId);
    }

    if (filters.listingType && filters.listingType !== "all") {
      result = result.filter((l) => l.listingType === filters.listingType);
    }

    if (filters.maxPriceCents !== undefined && filters.maxPriceCents > 0) {
      result = result.filter((l) => l.askingPriceCents <= filters.maxPriceCents!);
    }

    if (filters.ticketTier && filters.ticketTier !== "all") {
      result = result.filter((l) => l.ticketTier === filters.ticketTier);
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.eventTitle.toLowerCase().includes(q) ||
          l.venueName.toLowerCase().includes(q) ||
          l.seller.sellerName.toLowerCase().includes(q) ||
          l.ticketTier.toLowerCase().includes(q),
      );
    }

    // Sort
    if (filters.sortBy === "price_low") {
      result.sort((a, b) => a.askingPriceCents - b.askingPriceCents);
    } else if (filters.sortBy === "price_high") {
      result.sort((a, b) => b.askingPriceCents - a.askingPriceCents);
    } else if (filters.sortBy === "trust_score") {
      result.sort((a, b) => b.seller.trustScore - a.seller.trustScore);
    } else {
      // Default: newest
      result.sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime());
    }

    return result;
  }

  public createListing(data: {
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    venueName: string;
    eventImageUrl?: string;
    ticketId: string;
    ticketTier: TicketListing["ticketTier"];
    faceValueCents: number;
    askingPriceCents: number;
    listingType: TicketListing["listingType"];
    tradePreferences?: string;
    sellerId: string;
    sellerName: string;
    sellerAvatar?: string;
    notes?: string;
  }): TicketListing {
    // Anti-scalping face value policy check (max 100% face value allowed)
    const maxAllowedPriceCents = data.faceValueCents; // Capped at face value
    if (data.askingPriceCents > maxAllowedPriceCents) {
      throw new Error(
        `Anti-Scalping Violation: Asking price ($${(
          data.askingPriceCents / 100
        ).toFixed(2)}) exceeds maximum allowed face value cap ($${(
          maxAllowedPriceCents / 100
        ).toFixed(2)}).`,
      );
    }

    const id = `MKT-LST-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const newListing: TicketListing = {
      id,
      eventId: data.eventId,
      eventTitle: data.eventTitle,
      eventDate: data.eventDate,
      venueName: data.venueName,
      eventImageUrl:
        data.eventImageUrl ||
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80",
      ticketId: data.ticketId,
      ticketTier: data.ticketTier,
      faceValueCents: data.faceValueCents,
      askingPriceCents: data.askingPriceCents,
      maxAllowedPriceCents,
      listingType: data.listingType,
      tradePreferences: data.tradePreferences,
      seller: {
        sellerId: data.sellerId,
        sellerName: data.sellerName,
        sellerAvatar:
          data.sellerAvatar ||
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        isVerifiedStudent: true,
        accountAgeDays: 180,
        successfulTransfersCount: 3,
        noShowRate: 0.0,
        trustScore: 96,
      },
      status: "active",
      listedAt: now,
      notes: data.notes || "",
    };

    this.listings.unshift(newListing);
    this.notify();
    return newListing;
  }

  public executeTicketTransfer(
    listingId: string,
    buyerId: string,
    buyerName: string = "Rushabh Mahajan",
  ): TicketListing | undefined {
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing || listing.status !== "active") return undefined;

    const now = new Date();
    listing.status = "completed";
    listing.completedAt = now;
    listing.buyerId = buyerId;
    listing.buyerName = buyerName;

    this.notify();
    return listing;
  }

  public cancelListing(listingId: string): boolean {
    const listing = this.listings.find((l) => l.id === listingId);
    if (!listing || listing.status !== "active") return false;

    listing.status = "cancelled";
    this.notify();
    return true;
  }

  public getMarketplaceStats(eventId?: string): MarketplaceStats {
    const relevant = eventId
      ? this.listings.filter((l) => l.eventId === eventId)
      : this.listings;

    const activeListings = relevant.filter((l) => l.status === "active");
    const completedListings = relevant.filter((l) => l.status === "completed");

    const totalActiveListings = activeListings.length;

    let totalPrice = 0;
    let totalFace = 0;
    activeListings.forEach((l) => {
      totalPrice += l.askingPriceCents;
      totalFace += l.faceValueCents;
    });

    const avgResalePriceCents =
      totalActiveListings > 0 ? Math.round(totalPrice / totalActiveListings) : 3200;
    const avgFaceValueCents =
      totalActiveListings > 0 ? Math.round(totalFace / totalActiveListings) : 3500;

    let totalVolumeTransferredCents = 0;
    completedListings.forEach((l) => {
      totalVolumeTransferredCents += l.askingPriceCents;
    });

    return {
      totalActiveListings,
      avgResalePriceCents,
      avgFaceValueCents,
      demandIndex: 3.2, // 3.2 buyers per active listing
      totalVolumeTransferredCents: totalVolumeTransferredCents || 125000,
      totalTransfersCompleted: completedListings.length || 14,
    };
  }

  public resetToSample() {
    this.listings = [...INITIAL_LISTINGS];
    this.notify();
  }
}

export const ticketTransferMarketplaceService = new TicketTransferMarketplaceService();
