/**
 * Crypto Donation and Tax Types for CampusConnect
 * Defines interfaces for capital gains calculation and tax benefit visualization.
 */

export interface CryptoAsset {
    symbol: string;
    name: string;
    currentPrice: number;
}

export interface TaxCalculationInput {
    assetSymbol: string;
    donationAmountUsd: number;
    costBasisPerCoin: number;
    taxRate: number; // e.g., 0.20 for 20%
}

export interface TaxCalculationResult {
    coinAmount: number;
    unrealizedGains: number;
    estimatedTaxLiability: number;
    taxDeductionValue: number; // Assuming donor is in a tax bracket where deduction saves them this much
    totalValueToDonor: number; // tax avoided + deduction value
    effectiveBonusPercentage: number;
}
