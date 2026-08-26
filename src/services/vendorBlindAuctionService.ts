import {
  BlindAuctionGig,
  CreateBlindAuctionInput,
  SealedVendorBid,
  SubmitSealedBidInput,
  UnsealedAuctionResult,
  BlindAuctionViewMode,
} from "../types/vendorBlindAuction";

export class VendorBlindAuctionService {
  private auctions: Map<string, BlindAuctionGig> = new Map();
  private bids: Map<string, SealedVendorBid[]> = new Map();
  // Secret salt store for unsealing
  private privateBidStore: Map<
    string,
    { amount: number; salt: string; proposal: string; deliverables: string[] }
  > = new Map();

  /**
   * Helper to compute SHA-256 commitment hash in Node/Browser environments
   */
  public async computeCommitmentHash(
    bidAmount: number,
    salt: string,
    vendorId: string,
  ): Promise<string> {
    const raw = `${bidAmount}:${salt}:${vendorId}`;
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback hash implementation
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `sha256_mock_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Creates a new blind auction gig posted by the organizer
   */
  public async createBlindAuction(input: CreateBlindAuctionInput): Promise<BlindAuctionGig> {
    const auctionId = `auction_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const auction: BlindAuctionGig = {
      id: auctionId,
      organizerId: input.organizerId,
      organizerName: input.organizerName,
      eventId: input.eventId,
      eventName: input.eventName,
      title: input.title,
      description: input.description,
      category: input.category,
      maxBudget: input.maxBudget,
      isBlindAuction: true,
      biddingDeadline: input.biddingDeadline,
      status: "OPEN_SEALED",
      sealsBrokenAt: null,
      awardedBidId: null,
      awardedVendorId: null,
      totalBidsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.auctions.set(auctionId, auction);
    this.bids.set(auctionId, []);
    return auction;
  }

  /**
   * Submits a sealed bid with cryptographic commitment hash
   */
  public async submitSealedBid(input: SubmitSealedBidInput): Promise<SealedVendorBid> {
    const auction = this.auctions.get(input.auctionId);
    if (!auction) {
      throw new Error(`Blind auction with ID ${input.auctionId} not found.`);
    }

    if (auction.status !== "OPEN_SEALED") {
      throw new Error(`Auction is closed or seals have already been broken.`);
    }

    const salt = input.salt || Math.random().toString(36).substring(2, 15);
    const commitmentHash = await this.computeCommitmentHash(input.bidAmount, salt, input.vendorId);
    const bidId = `bid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    // Store unsealed data in private vault
    this.privateBidStore.set(bidId, {
      amount: input.bidAmount,
      salt,
      proposal: input.proposalDetails,
      deliverables: input.deliverablesSummary || [],
    });

    const sealedBid: SealedVendorBid = {
      id: bidId,
      auctionId: input.auctionId,
      vendorId: input.vendorId,
      vendorName: input.vendorName,
      vendorEmail: input.vendorEmail,
      vendorRating: input.vendorRating || 5.0,
      commitmentHash,
      encryptedAmountPayload: Buffer.from(`ENC:${input.bidAmount}:${salt}`).toString("base64"),
      isSealed: true,
      submittedAt: now,
      revealedBidAmount: null, // Hidden from everyone
      proposalDetails: null,
      deliverablesSummary: null,
      unsealedAt: null,
    };

    const existingBids = this.bids.get(input.auctionId) || [];
    existingBids.push(sealedBid);
    this.bids.set(input.auctionId, existingBids);

    auction.totalBidsCount = existingBids.length;
    auction.updatedAt = now;

    return sealedBid;
  }

  /**
   * Retrieves bids tailored for the viewer's permission level.
   * Competing vendors and organizers BEFORE deadline only see sealed cards (amounts are masked).
   */
  public getVisibleBids(auctionId: string, viewMode: BlindAuctionViewMode): SealedVendorBid[] {
    const auction = this.auctions.get(auctionId);
    if (!auction) return [];

    const bids = this.bids.get(auctionId) || [];

    // If seals are broken, all unsealed details are visible
    if (auction.status === "SEALS_BROKEN" || auction.status === "AWARDED") {
      return bids;
    }

    // Before deadline / while seals are intact:
    return bids.map((b) => {
      // The vendor who placed the bid can see their own amount
      if (viewMode.viewerRole === "BIDDING_VENDOR" && viewMode.viewerVendorId === b.vendorId) {
        const privateData = this.privateBidStore.get(b.id);
        return {
          ...b,
          revealedBidAmount: privateData?.amount || null,
          proposalDetails: privateData?.proposal || null,
          deliverablesSummary: privateData?.deliverables || null,
        };
      }

      // For everyone else (competing vendors & organizer before deadline): completely sealed
      return {
        ...b,
        vendorName:
          viewMode.viewerRole === "ORGANIZER" ? b.vendorName : `Vendor #${b.id.substring(4, 8)}`,
        vendorEmail: "[SEALED]",
        revealedBidAmount: null,
        proposalDetails: "[SEALED UNTIL DEADLINE]",
        deliverablesSummary: ["[SEALED]"],
        isSealed: true,
      };
    });
  }

  /**
   * Breaks seals after deadline and unseals all bids simultaneously for organizer evaluation
   */
  public async breakSealsAndRevealBids(auctionId: string): Promise<UnsealedAuctionResult> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error(`Blind auction with ID ${auctionId} not found.`);
    }

    const now = new Date();
    const deadline = new Date(auction.biddingDeadline);

    // Unseal all bids
    const bidsList = this.bids.get(auctionId) || [];
    const revealedBids = [];

    for (const b of bidsList) {
      const privateData = this.privateBidStore.get(b.id);
      if (privateData) {
        b.isSealed = false;
        b.revealedBidAmount = privateData.amount;
        b.proposalDetails = privateData.proposal;
        b.deliverablesSummary = privateData.deliverables;
        b.unsealedAt = now.toISOString();

        const savings = auction.maxBudget - privateData.amount;
        const isWithinBudget = privateData.amount <= auction.maxBudget;

        // Value score combines price economy and vendor rating
        const priceEfficiency = Math.max(
          0,
          (auction.maxBudget - privateData.amount) / auction.maxBudget,
        );
        const valueScore = parseFloat(
          (priceEfficiency * 60 + (b.vendorRating || 5.0) * 8).toFixed(2),
        );

        revealedBids.push({
          bidId: b.id,
          vendorId: b.vendorId,
          vendorName: b.vendorName,
          revealedAmount: privateData.amount,
          savingsBelowBudget: Math.max(0, savings),
          proposalDetails: privateData.proposal,
          deliverablesSummary: privateData.deliverables,
          isWithinBudget,
          rank: 0,
          valueScore,
        });
      }
    }

    // Sort by lowest price first
    revealedBids.sort((a, b) => a.revealedAmount - b.revealedAmount);
    revealedBids.forEach((b, index) => {
      b.rank = index + 1;
    });

    auction.status = "SEALS_BROKEN";
    auction.sealsBrokenAt = now.toISOString();
    auction.updatedAt = now.toISOString();

    const recommendedLowestBidId = revealedBids[0]?.bidId;
    const recommendedBestValueBidId = [...revealedBids].sort(
      (a, b) => b.valueScore - a.valueScore,
    )[0]?.bidId;

    return {
      auctionId,
      title: auction.title,
      maxBudget: auction.maxBudget,
      biddingDeadline: auction.biddingDeadline,
      sealsBrokenAt: now.toISOString(),
      totalBids: revealedBids.length,
      bids: revealedBids,
      recommendedLowestBidId,
      recommendedBestValueBidId,
    };
  }

  /**
   * Awards the gig to the chosen vendor
   */
  public async awardGig(auctionId: string, bidId: string): Promise<BlindAuctionGig> {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error(`Auction ${auctionId} not found.`);
    }

    const bids = this.bids.get(auctionId) || [];
    const chosenBid = bids.find((b) => b.id === bidId);
    if (!chosenBid) {
      throw new Error(`Bid ${bidId} not found.`);
    }

    auction.status = "AWARDED";
    auction.awardedBidId = bidId;
    auction.awardedVendorId = chosenBid.vendorId;
    auction.updatedAt = new Date().toISOString();

    return auction;
  }

  public getAuctionById(auctionId: string): BlindAuctionGig | null {
    return this.auctions.get(auctionId) || null;
  }

  public clear(): void {
    this.auctions.clear();
    this.bids.clear();
    this.privateBidStore.clear();
  }
}

export const vendorBlindAuctionService = new VendorBlindAuctionService();
