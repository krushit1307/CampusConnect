import { describe, it, expect, beforeEach } from "vitest";
import {
  TicketResalePriceCapEngine,
  ResaleMarketplaceListing,
} from "../../src/services/ticketResalePriceCapEngine";

describe("TicketResalePriceCapEngine (#4137)", () => {
  beforeEach(() => {
    TicketResalePriceCapEngine.resetState();
  });

  it("should successfully list ticket when resalePrice <= originalPrice", () => {
    const listing = TicketResalePriceCapEngine.listTicketForResale({
      ticketId: "tkt-123",
      eventId: "evt-spring-fest",
      eventTitle: "Spring Music Festival",
      sellerUserId: "user-seller-1",
      sellerName: "Alice Walker",
      originalPrice: 40.0,
      resalePrice: 40.0, // Face value
      tierName: "GA Tier 1",
    });

    expect(listing.id).toBeDefined();
    expect(listing.status).toBe("AVAILABLE");
    expect(listing.resalePrice).toBe(40.0);
    expect(listing.originalPrice).toBe(40.0);
  });

  it("should allow discounted resales below face value", () => {
    const listing = TicketResalePriceCapEngine.listTicketForResale({
      ticketId: "tkt-124",
      eventId: "evt-spring-fest",
      eventTitle: "Spring Music Festival",
      sellerUserId: "user-seller-2",
      sellerName: "Bob Ross",
      originalPrice: 50.0,
      resalePrice: 35.0, // Discounted
    });

    expect(listing.resalePrice).toBe(35.0);
    expect(listing.status).toBe("AVAILABLE");
  });

  it("should strictly reject any attempt to scalp or list above original price", () => {
    expect(() =>
      TicketResalePriceCapEngine.listTicketForResale({
        ticketId: "tkt-scalp",
        eventId: "evt-spring-fest",
        eventTitle: "Spring Music Festival",
        sellerUserId: "user-scalper",
        sellerName: "Scalper",
        originalPrice: 30.0,
        resalePrice: 65.0, // Scalped attempt
      }),
    ).toThrow(
      /Anti-Scalping Violation: Resale price \(\$65.00\) cannot exceed the original purchase price \(\$30.00\)/,
    );
  });

  it("should reject negative prices", () => {
    expect(() =>
      TicketResalePriceCapEngine.listTicketForResale({
        ticketId: "tkt-neg",
        eventId: "evt-spring-fest",
        eventTitle: "Spring Music Festival",
        sellerUserId: "user-1",
        sellerName: "User",
        originalPrice: 20.0,
        resalePrice: -5.0,
      }),
    ).toThrow(/cannot be negative/);
  });

  it("should execute atomic ticket swap, revoke old barcode, mint new ticket, and settle Stripe payout", () => {
    const listing = TicketResalePriceCapEngine.listTicketForResale({
      ticketId: "tkt-legit-999",
      eventId: "evt-spring-fest",
      eventTitle: "Spring Music Festival",
      sellerUserId: "user-seller-1",
      sellerName: "Alice Walker",
      originalPrice: 25.0,
      resalePrice: 25.0,
    });

    // Lock in escrow
    const locked = TicketResalePriceCapEngine.lockForEscrow(listing.id, "user-buyer-2");
    expect(locked.status).toBe("PENDING_ESCROW");
    expect(locked.buyerUserId).toBe("user-buyer-2");

    // Execute atomic swap
    const swapResult = TicketResalePriceCapEngine.executeAtomicTicketSwap(
      listing.id,
      "user-buyer-2",
    );

    expect(swapResult.success).toBe(true);
    expect(swapResult.revokedBarcodeToken).toContain("REVOKED-TKT-");
    expect(swapResult.newTicketId).toBeDefined();
    expect(swapResult.newBarcodeToken).toContain("AUTH-QR-SECURE-");
    expect(swapResult.payoutAmount).toBe(25.0);
    expect(swapResult.stripeChargeId).toBeDefined();
    expect(swapResult.stripeTransferId).toBeDefined();

    // Listing is marked SOLD
    const updatedListing = TicketResalePriceCapEngine.getListingById(listing.id);
    expect(updatedListing?.status).toBe("SOLD");
  });

  it("should allow seller to cancel listing before sale", () => {
    const listing = TicketResalePriceCapEngine.listTicketForResale({
      ticketId: "tkt-cancel-me",
      eventId: "evt-spring-fest",
      eventTitle: "Spring Music Festival",
      sellerUserId: "user-seller-1",
      sellerName: "Alice Walker",
      originalPrice: 15.0,
      resalePrice: 15.0,
    });

    const cancelled = TicketResalePriceCapEngine.cancelListing(listing.id, "user-seller-1");
    expect(cancelled.status).toBe("CANCELLED");

    // Should not allow non-seller to cancel
    expect(() => TicketResalePriceCapEngine.cancelListing(listing.id, "user-imposter")).toThrow(
      /Unauthorized/,
    );
  });
});
