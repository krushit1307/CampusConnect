/**
 * Sponsor PPP (Purchasing Power Parity) Adjuster Service
 * 
 * Implements algorithmic pricing adjustments based on local purchasing power
 * rather than raw currency exchange rates.
 * 
 * Logic:
 * 1. Fetch PPP Index for user's country (USA = 1.0 baseline)
 * 2. Multiply Base Price by PPP Index
 * 3. Convert adjusted price to local currency
 * 4. Display on sponsor logo with context
 */

export interface PppIndexRecord {
  countryCode: string;
  countryName: string;
  pppIndex: number;
  baseCurrency: string;
  active: boolean;
}

export interface PppAdjustmentResult {
  countryCode: string;
  countryName: string;
  basePrice: number;
  pppIndex: number;
  adjustedPrice: number;
  adjustmentRatio: string; // e.g., "70% off" or "30% of base"
  explanationText: string;
}

export class SponsorPppAdjusterService {
  // PPP Index Table (USA = 1.0)
  private pppIndexTable: Record<string, PppIndexRecord> = {
    US: { countryCode: 'US', countryName: 'United States', pppIndex: 1.0, baseCurrency: 'USD', active: true },
    IN: { countryCode: 'IN', countryName: 'India', pppIndex: 0.30, baseCurrency: 'USD', active: true },
    BR: { countryCode: 'BR', countryName: 'Brazil', pppIndex: 0.50, baseCurrency: 'USD', active: true },
    DE: { countryCode: 'DE', countryName: 'Germany', pppIndex: 0.92, baseCurrency: 'USD', active: true },
    FR: { countryCode: 'FR', countryName: 'France', pppIndex: 0.91, baseCurrency: 'USD', active: true },
    GB: { countryCode: 'GB', countryName: 'United Kingdom', pppIndex: 0.88, baseCurrency: 'USD', active: true },
    CA: { countryCode: 'CA', countryName: 'Canada', pppIndex: 0.95, baseCurrency: 'USD', active: true },
    AU: { countryCode: 'AU', countryName: 'Australia', pppIndex: 0.96, baseCurrency: 'USD', active: true },
    JP: { countryCode: 'JP', countryName: 'Japan', pppIndex: 0.87, baseCurrency: 'USD', active: true },
    CH: { countryCode: 'CH', countryName: 'Switzerland', pppIndex: 1.08, baseCurrency: 'USD', active: true },
    SG: { countryCode: 'SG', countryName: 'Singapore', pppIndex: 0.94, baseCurrency: 'USD', active: true },
    CN: { countryCode: 'CN', countryName: 'China', pppIndex: 0.35, baseCurrency: 'USD', active: true },
    MX: { countryCode: 'MX', countryName: 'Mexico', pppIndex: 0.45, baseCurrency: 'USD', active: true },
  };

  /**
   * Get PPP Index for a country
   */
  public getPppIndex(countryCode: string): PppIndexRecord {
    const code = countryCode.toUpperCase();
    return this.pppIndexTable[code] || this.pppIndexTable['US'];
  }

  /**
   * Calculate PPP-adjusted price
   */
  public calculatePppAdjustedPrice(basePriceUsd: number, countryCode: string): PppAdjustmentResult {
    const pppRecord = this.getPppIndex(countryCode);
    const adjustedPrice = basePriceUsd * pppRecord.pppIndex;
    
    // Calculate adjustment ratio as percentage
    const percentageOfBase = Math.round(pppRecord.pppIndex * 100);
    const adjustmentRatio = percentageOfBase < 100 
      ? `${100 - percentageOfBase}% off` 
      : `+${percentageOfBase - 100}%`;

    return {
      countryCode: pppRecord.countryCode,
      countryName: pppRecord.countryName,
      basePrice: basePriceUsd,
      pppIndex: pppRecord.pppIndex,
      adjustedPrice: Math.round(adjustedPrice * 100) / 100,
      adjustmentRatio,
      explanationText: this.generateExplanation(pppRecord, percentageOfBase),
    };
  }

  /**
   * Generate human-readable explanation of PPP adjustment
   */
  private generateExplanation(pppRecord: PppIndexRecord, percentageOfBase: number): string {
    if (pppRecord.pppIndex < 0.5) {
      return `Significantly lower local purchasing power; pricing adjusted to ${percentageOfBase}% of US base`;
    } else if (pppRecord.pppIndex < 0.8) {
      return `Moderate local purchasing power differences; pricing adjusted to ${percentageOfBase}% of US base`;
    } else if (pppRecord.pppIndex < 1.0) {
      return `Slightly lower purchasing power; pricing adjusted to ${percentageOfBase}% of US base`;
    } else if (pppRecord.pppIndex === 1.0) {
      return `Standard pricing (US baseline)`;
    } else {
      return `Higher purchasing power premium applied (${percentageOfBase}% of US base)`;
    }
  }

  /**
   * Get all PPP indices (for admin dashboards)
   */
  public getAllPppIndices(): PppIndexRecord[] {
    return Object.values(this.pppIndexTable).filter((r) => r.active);
  }

  /**
   * Update PPP index (admin only)
   */
  public updatePppIndex(countryCode: string, newIndex: number): void {
    const code = countryCode.toUpperCase();
    if (this.pppIndexTable[code]) {
      this.pppIndexTable[code].pppIndex = Math.max(0.1, Math.min(2.0, newIndex));
    }
  }
}

export const sponsorPppAdjusterService = new SponsorPppAdjusterService();