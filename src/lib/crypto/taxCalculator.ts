import { TaxCalculationInput, TaxCalculationResult, CryptoAsset } from '@/types/crypto';

// Mock current crypto prices (In production, fetch from CoinGecko/CoinMarketCap API)
const MOCK_PRICES: Record<string, number> = {
    BTC: 65000,
    ETH: 3500,
    SOL: 150,
};

/**
 * Calculates the tax benefits of donating appreciated crypto assets directly.
 */
export function calculateCryptoTaxBenefits(input: TaxCalculationInput): TaxCalculationResult {
    const currentPrice = MOCK_PRICES[input.assetSymbol] || input.costBasisPerCoin;

    if (currentPrice <= input.costBasisPerCoin) {
        // No capital gains if price hasn't appreciated
        return {
            coinAmount: input.donationAmountUsd / currentPrice,
            unrealizedGains: 0,
            estimatedTaxLiability: 0,
            taxDeductionValue: input.donationAmountUsd * input.taxRate,
            totalValueToDonor: input.donationAmountUsd * input.taxRate,
            effectiveBonusPercentage: input.taxRate * 100,
        };
    }

    // 1. Calculate how many coins are being donated
    const coinAmount = input.donationAmountUsd / currentPrice;

    // 2. Calculate Unrealized Capital Gains
    // Gains = (Current Price - Cost Basis) * Number of Coins
    const unrealizedGains = (currentPrice - input.costBasisPerCoin) * coinAmount;

    // 3. Calculate Estimated Tax Liability if sold for cash
    const estimatedTaxLiability = unrealizedGains * input.taxRate;

    // 4. Calculate Tax Deduction Value (Donating the full fair market value is deductible)
    // Assuming the donor itemizes and the deduction saves them at their marginal tax rate
    const taxDeductionValue = input.donationAmountUsd * input.taxRate;

    // 5. Total Value to Donor = Tax Avoided + Deduction Value
    const totalValueToDonor = estimatedTaxLiability + taxDeductionValue;

    // 6. Effective Bonus Percentage (Total Value / Donation Amount)
    const effectiveBonusPercentage = (totalValueToDonor / input.donationAmountUsd) * 100;

    return {
        coinAmount,
        unrealizedGains,
        estimatedTaxLiability,
        taxDeductionValue,
        totalValueToDonor,
        effectiveBonusPercentage,
    };
}

/**
 * Fetches current crypto prices (mocked).
 */
export async function getCurrentCryptoPrices(): Promise<Record<string, number>> {
    // In production: const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
    return MOCK_PRICES;
}
