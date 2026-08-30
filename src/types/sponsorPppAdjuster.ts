export interface PppIndexTableRow {
  id?: number;
  countryCode: string;
  countryName: string;
  pppIndex: number;
  baseCurrency: string;
  effectiveDate?: Date;
  lastUpdated?: Date;
  notes?: string;
  active: boolean;
}

export interface PppAdjustmentContext {
  countryCode: string;
  countryName: string;
  basePrice: number;
  pppIndex: number;
  adjustedPrice: number;
  adjustmentRatio: string;
  explanationText: string;
}

export interface PppPricingResult {
  originalPrice: number;
  pppAdjustedPrice: number;
  localCurrencyPrice: number;
  pppMultiplier: number;
  savingsPercentage: number;
}