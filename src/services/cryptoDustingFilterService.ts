import {
  coingeckoTokenPriceUrl,
  evaluateDustingAttack,
  parseCoingeckoTokenPrice,
  shouldCreditDonation,
  type DustingDecision,
  type IncomingCryptoTransfer,
  type IndexedCryptoDonation,
} from "@/lib/cryptoDustingFilter";

export type IndexedTransfer = IncomingCryptoTransfer & {
  clubId: string;
  walletAddress: string;
  chain: "ethereum" | "polygon";
};

export type OracleFn = (chain: "ethereum" | "polygon", contract: string) => Promise<number | null>;

export async function fetchCoingeckoUsdPrice(
  chain: "ethereum" | "polygon",
  contract: string,
  http: typeof fetch = fetch,
): Promise<number | null> {
  const response = await http(coingeckoTokenPriceUrl(chain, contract));
  if (!response.ok) return null;
  return parseCoingeckoTokenPrice(await response.json(), contract);
}

export async function interceptIncomingTransfer(
  transfer: IndexedTransfer,
  scamRegistry: Iterable<string>,
  oracle: OracleFn = fetchCoingeckoUsdPrice,
): Promise<IndexedCryptoDonation> {
  const priced =
    transfer.usdPrice != null
      ? transfer
      : {
          ...transfer,
          usdPrice: transfer.tokenContract
            ? await oracle(transfer.chain, transfer.tokenContract)
            : (transfer.usdPrice ?? 0),
        };
  return evaluateDustingAttack(priced, scamRegistry);
}

export function donationSideEffects(decision: IndexedCryptoDonation): {
  creditLedger: boolean;
  awardPoints: boolean;
  sendPush: boolean;
  status: DustingDecision;
} {
  const credit = shouldCreditDonation(decision);
  return {
    creditLedger: credit,
    awardPoints: credit,
    sendPush: credit,
    status: decision.status,
  };
}
