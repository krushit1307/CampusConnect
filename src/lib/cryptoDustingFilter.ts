export const DUST_USD_THRESHOLD = 1;
export const NATIVE_TOKEN = "native";

export type DustingDecision = "credited" | "dropped_dust" | "dropped_scam";

export type IncomingCryptoTransfer = {
  txHash: string;
  tokenContract: string | null;
  tokenAmount: number;
  tokenDecimals?: number;
  usdPrice?: number | null;
};

export type IndexedCryptoDonation = IncomingCryptoTransfer & {
  fiatUsd: number;
  status: DustingDecision;
};

export function normalizeTokenContract(contract: string | null | undefined): string {
  if (!contract) return NATIVE_TOKEN;
  return contract.trim().toLowerCase();
}

export function isScamToken(
  tokenContract: string | null | undefined,
  scamRegistry: Iterable<string>,
): boolean {
  const normalized = normalizeTokenContract(tokenContract);
  if (normalized === NATIVE_TOKEN) return false;
  const flagged = new Set([...scamRegistry].map((entry) => entry.toLowerCase()));
  return flagged.has(normalized);
}

export function fiatValueUsd(tokenAmount: number, usdPrice: number | null | undefined): number {
  if (usdPrice == null || !Number.isFinite(usdPrice) || !Number.isFinite(tokenAmount)) return 0;
  return tokenAmount * usdPrice;
}

export function evaluateDustingAttack(
  transfer: IncomingCryptoTransfer,
  scamRegistry: Iterable<string> = [],
): IndexedCryptoDonation {
  const fiatUsd =
    transfer.usdPrice == null ? 0 : fiatValueUsd(transfer.tokenAmount, transfer.usdPrice);
  let status: DustingDecision = "credited";
  if (isScamToken(transfer.tokenContract, scamRegistry)) {
    status = "dropped_scam";
  } else if (fiatUsd < DUST_USD_THRESHOLD) {
    status = "dropped_dust";
  }
  return {
    ...transfer,
    txHash: transfer.txHash,
    fiatUsd,
    status,
  };
}

export function shouldCreditDonation(decision: IndexedCryptoDonation): boolean {
  return decision.status === "credited";
}

export function visibleDonationLedger<T extends { dropped?: boolean; status?: DustingDecision }>(
  entries: T[],
): T[] {
  return entries.filter((entry) => {
    if (entry.dropped) return false;
    if (entry.status && entry.status !== "credited") return false;
    return true;
  });
}

export function coingeckoTokenPriceUrl(chain: "ethereum" | "polygon", contract: string): string {
  const platform = chain === "polygon" ? "polygon-pos" : "ethereum";
  return `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(contract)}&vs_currencies=usd`;
}

export function parseCoingeckoTokenPrice(payload: unknown, contract: string): number | null {
  const root = (payload ?? {}) as Record<string, { usd?: number } | undefined>;
  const price = root[contract.toLowerCase()]?.usd ?? root[contract]?.usd;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}
