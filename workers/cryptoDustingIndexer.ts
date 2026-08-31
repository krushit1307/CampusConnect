// =============================================================================
// Worker: Club crypto donation dusting filter
// Issue: #5281 - Index ETH/Polygon club wallets and drop dust/scam transfers
// =============================================================================

import {
  donationSideEffects,
  fetchCoingeckoUsdPrice,
  interceptIncomingTransfer,
  type IndexedTransfer,
} from "../src/services/cryptoDustingFilterService";

export async function indexClubTransfers(
  transfers: IndexedTransfer[],
  scamRegistry: Iterable<string>,
  persist: (transfer: IndexedTransfer, status: string, fiatUsd: number) => Promise<void>,
  credit: (transfer: IndexedTransfer, fiatUsd: number) => Promise<void>,
): Promise<{ credited: number; dropped: number }> {
  let credited = 0;
  let dropped = 0;
  for (const transfer of transfers) {
    const decision = await interceptIncomingTransfer(
      transfer,
      scamRegistry,
      fetchCoingeckoUsdPrice,
    );
    const effects = donationSideEffects(decision);
    await persist(transfer, effects.status, decision.fiatUsd);
    if (effects.creditLedger) {
      await credit(transfer, decision.fiatUsd);
      credited += 1;
    } else {
      dropped += 1;
    }
  }
  return { credited, dropped };
}
