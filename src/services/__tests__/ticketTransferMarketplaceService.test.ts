import { describe, it, expect, beforeEach } from "vitest";
import { ticketTransferMarketplaceService } from "../ticketTransferMarketplaceService";

describe("ticketTransferMarketplaceService", () => {
  beforeEach(() => {
    ticketTransferMarketplaceService.resetToSample();
  });

  it("retrieves sample active ticket listings", () => {
    const listings = ticketTransferMarketplaceService.getListings();
    expect(listings.length).toBeGreaterThan(0);
    expect(listings.some((l) => l.listingType === "sell")).toBe(true);
    expect(listings.some((l) => l.listingType === "trade")).toBe(true);
  });

  it("enforces anti-scalping price cap during listing creation", () => {
    // Attempting to post a ticket asking $60 for a $40 face-value ticket
    expect(() => {
      ticketTransferMarketplaceService.createListing({
        eventId: "evt-test",
        eventTitle: "Test Gala",
        eventDate: new Date(),
        venueName: "Student Union",
        ticketId: "tkt-test",
        ticketTier: "General Admission",
        faceValueCents: 4000, // $40
        askingPriceCents: 6000, // $60 (Scalping violation!)
        listingType: "sell",
        sellerId: "user-1",
        sellerName: "Test Seller",
      });
    }).toThrow(/Anti-Scalping Violation/);
  });

  it("successfully creates a valid face-value ticket listing", () => {
    const listing = ticketTransferMarketplaceService.createListing({
      eventId: "evt-test-2",
      eventTitle: "Test Concert",
      eventDate: new Date(),
      venueName: "Campus Arena",
      ticketId: "tkt-test-2",
      ticketTier: "Student Floor",
      faceValueCents: 2500, // $25
      askingPriceCents: 2500, // $25
      listingType: "sell",
      sellerId: "user-2",
      sellerName: "Valid Seller",
    });

    expect(listing.id).toMatch(/^MKT-LST-\d{4}$/);
    expect(listing.status).toBe("active");
    expect(listing.askingPriceCents).toBe(2500);

    const fetched = ticketTransferMarketplaceService.getListings({
      searchQuery: "Test Concert",
    });
    expect(fetched.length).toBe(1);
  });

  it("executes ticket transfer and marks listing completed", () => {
    const listings = ticketTransferMarketplaceService.getListings();
    const activeListing = listings[0];

    const completed = ticketTransferMarketplaceService.executeTicketTransfer(
      activeListing.id,
      "user-buyer-99",
      "Buyer Name",
    );

    expect(completed).toBeDefined();
    expect(completed?.status).toBe("completed");
    expect(completed?.buyerId).toBe("user-buyer-99");
  });

  it("calculates accurate marketplace metrics", () => {
    const stats = ticketTransferMarketplaceService.getMarketplaceStats();
    expect(stats.totalActiveListings).toBeGreaterThan(0);
    expect(stats.avgResalePriceCents).toBeGreaterThan(0);
    expect(stats.avgFaceValueCents).toBeGreaterThan(0);
    expect(stats.demandIndex).toBeGreaterThan(0);
  });
});
