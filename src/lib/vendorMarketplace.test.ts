import { describe, it, expect } from "vitest";
import {
  validateVendorSetupToken,
  getApprovedVendorDirectory,
  validateCatalogItemInput,
  toggleVendorBookmark,
  EventVendorStorefront,
} from "./vendorMarketplace";

describe("Interactive Vendor Marketplace Suite (#2997)", () => {
  const sampleVendors: EventVendorStorefront[] = [
    {
      id: "v1",
      eventId: "fair_2026",
      name: "Artisan Coffee Roasters",
      description: "Craft coffee and pastries",
      setupToken: "tok_secret_vendor_1",
      approvalStatus: "APPROVED",
      boothNumber: "A-12",
    },
    {
      id: "v2",
      eventId: "fair_2026",
      name: "Unapproved T-Shirts",
      description: "Custom prints",
      setupToken: "tok_secret_vendor_2",
      approvalStatus: "PENDING",
    },
  ];

  it("authenticates external vendors via secure setup token", () => {
    const authenticated = validateVendorSetupToken("tok_secret_vendor_1", sampleVendors);
    expect(authenticated).not.toBeNull();
    expect(authenticated?.name).toBe("Artisan Coffee Roasters");

    const invalid = validateVendorSetupToken("tok_fake_123", sampleVendors);
    expect(invalid).toBeNull();
  });

  it("filters vendor directory to display only organizer-approved storefronts", () => {
    const directory = getApprovedVendorDirectory(sampleVendors);
    expect(directory.length).toBe(1);
    expect(directory[0].id).toBe("v1");
  });

  it("validates catalog item pricing and non-empty titles", () => {
    expect(validateCatalogItemInput({ itemName: "Cold Brew", price: 4.5 }).isValid).toBe(true);
    expect(validateCatalogItemInput({ itemName: "", price: 4.5 }).isValid).toBe(false);
    expect(validateCatalogItemInput({ itemName: "Croissant", price: -2 }).isValid).toBe(false);
  });

  it("toggles attendee vendor bookmark list accurately", () => {
    let bookmarks: string[] = [];
    bookmarks = toggleVendorBookmark(bookmarks, "v1");
    expect(bookmarks).toContain("v1");

    bookmarks = toggleVendorBookmark(bookmarks, "v1");
    expect(bookmarks).not.toContain("v1");
  });
});
