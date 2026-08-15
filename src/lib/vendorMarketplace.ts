export interface VendorCatalogItem {
  id: string;
  vendorId: string;
  itemName: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface EventVendorStorefront {
  id: string;
  eventId: string;
  name: string;
  description: string;
  websiteUrl?: string;
  logoUrl?: string;
  boothNumber?: string;
  setupToken: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  catalog?: VendorCatalogItem[];
}

/**
 * Validates vendor setup token access for non-student external vendor storefront management.
 */
export function validateVendorSetupToken(
  token: string,
  vendors: EventVendorStorefront[],
): EventVendorStorefront | null {
  if (!token || token.trim() === "") return null;
  const match = vendors.find((v) => v.setupToken === token);
  return match || null;
}

/**
 * Filters and formats event vendors for attendee directory viewing (only APPROVED vendors).
 */
export function getApprovedVendorDirectory(
  vendors: EventVendorStorefront[],
): EventVendorStorefront[] {
  return vendors.filter((v) => v.approvalStatus === "APPROVED");
}

/**
 * Validates external vendor catalog item input before database persistence.
 */
export function validateCatalogItemInput(item: { itemName: string; price: number }): {
  isValid: boolean;
  error?: string;
} {
  if (!item.itemName || item.itemName.trim().length === 0) {
    return { isValid: false, error: "Item name cannot be empty." };
  }

  if (typeof item.price !== "number" || item.price < 0) {
    return { isValid: false, error: "Price must be a valid non-negative number." };
  }

  return { isValid: true };
}

/**
 * Toggles a vendor ID in the attendee's bookmarked favorites list.
 */
export function toggleVendorBookmark(bookmarkedVendorIds: string[], vendorId: string): string[] {
  if (bookmarkedVendorIds.includes(vendorId)) {
    return bookmarkedVendorIds.filter((id) => id !== vendorId);
  }
  return [...bookmarkedVendorIds, vendorId];
}
