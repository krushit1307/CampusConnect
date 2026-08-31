export interface CryptoSlippageCheckRequest {
  donorId: string;
  clubId: string;
  tokenSymbol: string;
  inputAmount: number;
  estimatedValueUsdc: number;
  actualOutputUsdc: number;
}

export interface CryptoSlippageCheckResult {
  auditId: string;
  tokenSymbol: string;
  inputAmount: number;
  expectedValueUsdc: number;
  actualOutputUsdc: number;
  slippagePercent: number;
  slippageLossUsdc: number;
  isHighSlippage: boolean;
  warningMessage: string;
  recommendedStablecoinUrl: string;
}

export const SLIPPAGE_WARNING_THRESHOLD_PERCENT = 2.0;

/**
 * Calculates slippage percentage and dollar loss in USDC (#4983).
 */
export function calculateSlippage(
  expectedUsdc: number,
  actualUsdc: number
): { slippagePercent: number; slippageLossUsdc: number } {
  if (expectedUsdc <= 0) {
    return { slippagePercent: 0, slippageLossUsdc: 0 };
  }

  const loss = Math.max(0, expectedUsdc - actualUsdc);
  const percent = Math.round(((loss / expectedUsdc) * 100) * 100) / 100;

  return {
    slippagePercent: percent,
    slippageLossUsdc: Math.round(loss * 100) / 100,
  };
}

/**
 * Evaluates DEX liquidity and warns of high slippage (> 2.0%) before transaction signing (#4983).
 */
export function evaluateCryptoDonationSlippage(
  request: CryptoSlippageCheckRequest
): CryptoSlippageCheckResult {
  const auditId = `aud-slip-${Date.now()}`;
  const { slippagePercent, slippageLossUsdc } = calculateSlippage(
    request.estimatedValueUsdc,
    request.actualOutputUsdc
  );

  const isHighSlippage = slippagePercent > SLIPPAGE_WARNING_THRESHOLD_PERCENT;

  const formattedLoss = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(slippageLossUsdc);

  const warningMessage = isHighSlippage
    ? `WARNING: Low liquidity. You will lose approximately ${formattedLoss} in slippage (${slippagePercent.toFixed(
        2
      )}%) if you execute this transaction right now.`
    : `Slippage is optimal (${slippagePercent.toFixed(2)}%).`;

  return {
    auditId,
    tokenSymbol: request.tokenSymbol || "ALTCOIN",
    inputAmount: request.inputAmount,
    expectedValueUsdc: request.estimatedValueUsdc,
    actualOutputUsdc: request.actualOutputUsdc,
    slippagePercent,
    slippageLossUsdc,
    isHighSlippage,
    warningMessage,
    recommendedStablecoinUrl: "/donate/crypto?asset=USDC",
  };
}
