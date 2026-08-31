import { describe, it, expect } from "vitest";
import {
  calculateSlippage,
  evaluateCryptoDonationSlippage,
  CryptoSlippageCheckRequest,
} from "./cryptoDonationSlippage";

describe("Real-Time Donation Goal Predictive Slippage Alert Utility (#4983)", () => {
  const highSlippageRequest: CryptoSlippageCheckRequest = {
    donorId: "u-donor-1",
    clubId: "club-robotics-1",
    tokenSymbol: "ALTCOIN",
    inputAmount: 1000,
    estimatedValueUsdc: 10000,
    actualOutputUsdc: 8000,
  };

  const stablecoinRequest: CryptoSlippageCheckRequest = {
    donorId: "u-donor-1",
    clubId: "club-robotics-1",
    tokenSymbol: "USDC",
    inputAmount: 10000,
    estimatedValueUsdc: 10000,
    actualOutputUsdc: 9998,
  };

  it("calculates exact slippage percentage and dollar loss", () => {
    const { slippagePercent, slippageLossUsdc } = calculateSlippage(10000, 8000);
    expect(slippagePercent).toBe(20.0);
    expect(slippageLossUsdc).toBe(2000.0);
  });

  it("flags isHighSlippage = true and generates warning message when slippage > 2.0%", () => {
    const result = evaluateCryptoDonationSlippage(highSlippageRequest);

    expect(result.isHighSlippage).toBe(true);
    expect(result.slippagePercent).toBe(20.0);
    expect(result.slippageLossUsdc).toBe(2000.0);
    expect(result.warningMessage).toContain("WARNING: Low liquidity. You will lose approximately $2,000.00 in slippage");
  });

  it("returns optimal slippage status for USDC stablecoin swaps", () => {
    const result = evaluateCryptoDonationSlippage(stablecoinRequest);

    expect(result.isHighSlippage).toBe(false);
    expect(result.slippagePercent).toBeLessThan(2.0);
    expect(result.warningMessage).toContain("Slippage is optimal");
  });
});
