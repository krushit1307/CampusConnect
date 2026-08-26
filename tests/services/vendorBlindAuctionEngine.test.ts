import { describe, it, expect, beforeEach } from "vitest";
import { VendorBlindAuctionService } from "../../src/services/vendorBlindAuctionService";

describe("VendorBlindAuctionEngine Integration Tests", () => {
  let engine: VendorBlindAuctionService;

  beforeEach(() => {
    engine = new VendorBlindAuctionService();
    engine.clear();
  });

  it("computes SHA-256 cryptographic commitment hashes reliably", async () => {
    const hash1 = await engine.computeCommitmentHash(500, "salt123", "vendor_1");
    const hash2 = await engine.computeCommitmentHash(500, "salt123", "vendor_1");
    const hash3 = await engine.computeCommitmentHash(499, "salt123", "vendor_1");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBeGreaterThan(10);
  });

  it("handles competitive multi-vendor sealed auctions and prevents unauthorized mutations", async () => {
    const gig = await engine.createBlindAuction({
      organizerId: "org_2",
      organizerName: "Engineering Gala Organizers",
      eventId: "ev_gala",
      eventName: "Graduation Gala 2026",
      title: "Need Catering. Max Budget: $3000. Blind Auction.",
      description: "3-course buffet dinner for 200 guests.",
      category: "CATERING",
      maxBudget: 3000,
      biddingDeadline: "2026-08-29T18:00:00Z",
    });

    const vendors = [
      { id: "v1", name: "Gourmet Bites", amount: 2800 },
      { id: "v2", name: "Campus Delights", amount: 2400 },
      { id: "v3", name: "Artisan Feast", amount: 2600 },
    ];

    for (const v of vendors) {
      await engine.submitSealedBid({
        auctionId: gig.id,
        vendorId: v.id,
        vendorName: v.name,
        vendorEmail: `${v.id}@test.com`,
        bidAmount: v.amount,
        proposalDetails: "Full catering menu",
      });
    }

    const unsealed = await engine.breakSealsAndRevealBids(gig.id);
    expect(unsealed.totalBids).toBe(3);
    // Rank 1 must be Campus Delights at $2400
    expect(unsealed.bids[0].vendorName).toBe("Campus Delights");
    expect(unsealed.bids[0].revealedAmount).toBe(2400);
    expect(unsealed.bids[0].rank).toBe(1);

    // Attempting to submit another sealed bid after seals broken must fail
    await expect(
      engine.submitSealedBid({
        auctionId: gig.id,
        vendorId: "v4",
        vendorName: "Late Caterer",
        vendorEmail: "late@test.com",
        bidAmount: 2000,
        proposalDetails: "Late entry",
      }),
    ).rejects.toThrow("Auction is closed or seals have already been broken.");
  });
});
