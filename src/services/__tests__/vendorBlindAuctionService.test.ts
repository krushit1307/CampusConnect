import { describe, it, expect, beforeEach } from "vitest";
import { VendorBlindAuctionService } from "../vendorBlindAuctionService";

describe("VendorBlindAuctionService Unit Tests", () => {
  let service: VendorBlindAuctionService;

  beforeEach(() => {
    service = new VendorBlindAuctionService();
    service.clear();
  });

  it("creates a blind auction gig with max budget and deadline", async () => {
    const gig = await service.createBlindAuction({
      organizerId: "org_1",
      organizerName: "Student Union Events",
      eventId: "ev_spring_fest",
      eventName: "Spring Fest 2026",
      title: "Need a DJ. Max Budget: $600. Blind Auction.",
      description: "Looking for a campus DJ for 4-hour evening set.",
      category: "DJ",
      maxBudget: 600,
      biddingDeadline: "2026-08-28T17:00:00Z",
    });

    expect(gig.id).toBeDefined();
    expect(gig.isBlindAuction).toBe(true);
    expect(gig.status).toBe("OPEN_SEALED");
    expect(gig.maxBudget).toBe(600);
  });

  it("hides competing vendor bid amounts during OPEN_SEALED state", async () => {
    const gig = await service.createBlindAuction({
      organizerId: "org_1",
      organizerName: "Student Union Events",
      eventId: "ev_spring_fest",
      eventName: "Spring Fest 2026",
      title: "Need a DJ. Max Budget: $600. Blind Auction.",
      description: "DJ Gig",
      category: "DJ",
      maxBudget: 600,
      biddingDeadline: "2026-08-28T17:00:00Z",
    });

    // DJ Bob submits $500
    await service.submitSealedBid({
      auctionId: gig.id,
      vendorId: "vendor_bob",
      vendorName: "DJ Bob",
      vendorEmail: "bob@dj.com",
      bidAmount: 500,
      proposalDetails: "Pioneer DJ gear + 2 subwoofers",
    });

    // DJ Alice submits $450
    await service.submitSealedBid({
      auctionId: gig.id,
      vendorId: "vendor_alice",
      vendorName: "DJ Alice",
      vendorEmail: "alice@dj.com",
      bidAmount: 450,
      proposalDetails: "Full festival audio rig + lighting",
    });

    // DJ Alice views visible bids: she sees her own amount ($450), but Bob's bid is masked!
    const aliceView = service.getVisibleBids(gig.id, {
      viewerRole: "BIDDING_VENDOR",
      viewerVendorId: "vendor_alice",
    });

    expect(aliceView).toHaveLength(2);

    const bobInAliceView = aliceView.find((b) => b.vendorId === "vendor_bob");
    expect(bobInAliceView?.revealedBidAmount).toBeNull();
    expect(bobInAliceView?.proposalDetails).toBe("[SEALED UNTIL DEADLINE]");

    const aliceInAliceView = aliceView.find((b) => b.vendorId === "vendor_alice");
    expect(aliceInAliceView?.revealedBidAmount).toBe(450);
    expect(aliceInAliceView?.proposalDetails).toBe("Full festival audio rig + lighting");
  });

  it("breaks seals after deadline and ranks all bids simultaneously", async () => {
    const gig = await service.createBlindAuction({
      organizerId: "org_1",
      organizerName: "Student Union Events",
      eventId: "ev_spring_fest",
      eventName: "Spring Fest 2026",
      title: "Need a DJ. Max Budget: $600. Blind Auction.",
      description: "DJ Gig",
      category: "DJ",
      maxBudget: 600,
      biddingDeadline: "2026-08-28T17:00:00Z",
    });

    await service.submitSealedBid({
      auctionId: gig.id,
      vendorId: "vendor_bob",
      vendorName: "DJ Bob",
      vendorEmail: "bob@dj.com",
      bidAmount: 520,
      proposalDetails: "Pro DJ set",
      vendorRating: 4.8,
    });

    await service.submitSealedBid({
      auctionId: gig.id,
      vendorId: "vendor_alice",
      vendorName: "DJ Alice",
      vendorEmail: "alice@dj.com",
      bidAmount: 480,
      proposalDetails: "Full audio package",
      vendorRating: 4.9,
    });

    const result = await service.breakSealsAndRevealBids(gig.id);
    expect(result.totalBids).toBe(2);
    expect(result.bids[0].vendorName).toBe("DJ Alice");
    expect(result.bids[0].revealedAmount).toBe(480);
    expect(result.bids[0].rank).toBe(1);
    expect(result.bids[0].savingsBelowBudget).toBe(120);

    expect(result.bids[1].vendorName).toBe("DJ Bob");
    expect(result.bids[1].revealedAmount).toBe(520);
    expect(result.bids[1].rank).toBe(2);

    // Award contract to Alice
    const awarded = await service.awardGig(gig.id, result.bids[0].bidId);
    expect(awarded.status).toBe("AWARDED");
    expect(awarded.awardedVendorId).toBe("vendor_alice");
  });
});
