/**
 * Equity Swap Agreement Generator Service (Issue #5140).
 *
 * Constructs structured legal agreements for Sponsor PPP B2B Software License
 * Equity Swaps and computes SHA-256 cryptographic document hashes for immutability verification.
 */

import { EquitySwapAgreement, SponsorPppOffer } from "@/types/equitySwap";

export class AgreementGenerator {
  /**
   * Generates formatted agreement document text for a sponsor software license equity swap.
   */
  public generateAgreementText(
    offer: SponsorPppOffer,
    startupId: string,
    startupName: string,
    founderId: string,
    founderName: string,
  ): string {
    const today = new Date().toISOString().split("T")[0];

    return `
================================================================================
SIMPLE AGREEMENT FOR FUTURE EQUITY & SOFTWARE LICENSE SWAP ("SAFE SWAP")
================================================================================

Date of Execution: ${today}
Agreement Version: 1.0 (PPP Adjusted B2B License Swap)

PARTIES:
1. STARTUP ENTITY: ${startupName} (ID: ${startupId})
   Represented by Founder: ${founderName} (ID: ${founderId})

2. SPONSOR ENTITY: ${offer.sponsorName} (ID: ${offer.sponsorId})

--------------------------------------------------------------------------------
RECITALS & CONSIDERATION
--------------------------------------------------------------------------------
WHEREAS, Sponsor owns and operates the enterprise B2B software solution known as "${offer.softwareLicenseName}";
WHEREAS, Startup desires to acquire access to said software for a duration of ${offer.licenseDurationMonths} months;
WHEREAS, Sponsor agrees to apply a Purchasing Power Parity (PPP) adjustment factor of ${(offer.pppAdjustmentFactor * 100).toFixed(0)}%, valuing the license at $${offer.adjustedUsdValue.toFixed(2)} USD (Retail Value: $${offer.retailUsdValue.toFixed(2)} USD);
WHEREAS, in exchange for the provision of said B2B software license, Startup grants to Sponsor a ${offer.equityInstrument} equity instrument representing ${offer.equityPercentage.toFixed(2)}% equity interest in Startup upon a future qualified financing event.

--------------------------------------------------------------------------------
TERMS AND CONDITIONS
--------------------------------------------------------------------------------
1. SOFTWARE LICENSE ENTITLEMENT:
   Sponsor shall provision enterprise access keys for "${offer.softwareLicenseName}" within twenty-four (24) hours of dual signature finalization.

2. EQUITY INSTRUMENT GRANT:
   Startup irrevocably grants Sponsor a ${offer.equityInstrument} instrument equal to ${offer.equityPercentage.toFixed(2)}% of the fully diluted capital stock of Startup.

3. IMMUTABILITY & BLOCKCHAIN RECORDING:
   Upon execution by both parties, this Agreement shall produce a SHA-256 cryptographic hash anchored to the Polygon blockchain ledger. Terms cannot be modified post-finalization without creating a new agreement version.

4. LEGAL REVIEW DISCLAIMER:
   This document represents a structured agreement template. Parties confirm appropriate legal counsel has been consulted prior to binding signature.

--------------------------------------------------------------------------------
END OF AGREEMENT TEXT
================================================================================
`.trim();
  }

  /**
   * Computes a SHA-256 cryptographic hash of string content using Web Crypto API or simple hashing fallback.
   */
  public async computeSha256Hash(text: string): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        // Fallback below
      }
    }

    // Fallback simple hash for non-crypto environments
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `sha256_mock_${Math.abs(hash).toString(16).padStart(64, "0")}`;
  }

  /**
   * Verifies whether an existing agreement's hash matches its current text.
   */
  public async verifyImmutability(agreement: EquitySwapAgreement): Promise<boolean> {
    const computedHash = await this.computeSha256Hash(agreement.agreementText);
    return computedHash === agreement.documentSha256Hash;
  }
}

export const agreementGenerator = new AgreementGenerator();
