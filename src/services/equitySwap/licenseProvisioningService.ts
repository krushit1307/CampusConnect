/**
 * License Provisioning Service (Issue #5140).
 *
 * Provisions enterprise B2B software license keys and manages access entitlements
 * upon finalization of an equity swap agreement.
 */

import { ProvisionedLicenseEntitlement, SponsorPppOffer } from "@/types/equitySwap";

export class LicenseProvisioningService {
  /**
   * Provisions an enterprise software license key for an equity swap.
   */
  public async provisionSoftwareLicense(
    offer: SponsorPppOffer,
    startupId: string,
  ): Promise<ProvisionedLicenseEntitlement> {
    const now = new Date();
    const expires = new Date();
    expires.setMonth(expires.getMonth() + offer.licenseDurationMonths);

    // Generate secure formatted license key
    const prefix = offer.softwareLicenseName
      .replace(/[^A-Z0-9]/gi, "")
      .substring(0, 4)
      .toUpperCase();
    const randomBlock1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomBlock2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const licenseKey = `${prefix}-${randomBlock1}-${randomBlock2}-EQUITY`;

    const licenseUrl = `https://sponsors.campusconnect.edu/entitlements/${offer.sponsorId}/claim?key=${licenseKey}&startup=${startupId}`;

    return {
      licenseKey,
      licenseUrl,
      activatedAtIso: now.toISOString(),
      expiresAtIso: expires.toISOString(),
      seatsCount: 25, // Enterprise startup tier
      supportTier: "enterprise",
    };
  }
}

export const licenseProvisioningService = new LicenseProvisioningService();
