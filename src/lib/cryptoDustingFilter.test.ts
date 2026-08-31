import { describe, expect, it } from "vitest";
import {
  DUST_USD_THRESHOLD,
  evaluateDustingAttack,
  parseCoingeckoTokenPrice,
  shouldCreditDonation,
  visibleDonationLedger,
} from "./cryptoDustingFilter";

describe("crypto donation dusting filter (#5281)", () => {
  it("drops micro-penny transfers under $1 and scam-registry tokens", () => {
    expect(DUST_USD_THRESHOLD).toBe(1);
    const dust = evaluateDustingAttack({
      txHash: "0xdust",
      tokenContract: "0xscamtoken",
      tokenAmount: 5000,
      usdPrice: 0.0001,
    });
    expect(dust.status).toBe("dropped_dust");
    expect(shouldCreditDonation(dust)).toBe(false);

    const scam = evaluateDustingAttack(
      { txHash: "0xscam", tokenContract: "0xBadToken", tokenAmount: 10, usdPrice: 5 },
      ["0xbadtoken"],
    );
    expect(scam.status).toBe("dropped_scam");
    expect(shouldCreditDonation(scam)).toBe(false);
  });

  it("credits real donations and hides dropped rows from the UI ledger", () => {
    const gift = evaluateDustingAttack({
      txHash: "0xgift",
      tokenContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      tokenAmount: 25,
      usdPrice: 1,
    });
    expect(gift.status).toBe("credited");
    expect(
      visibleDonationLedger([dustRow(dustTx()), { ...gift, status: gift.status }]),
    ).toHaveLength(1);
    expect(parseCoingeckoTokenPrice({ "0xabc": { usd: 1.25 } }, "0xabc")).toBe(1.25);
  });
});

function dustTx() {
  return evaluateDustingAttack({
    txHash: "0xdust2",
    tokenContract: null,
    tokenAmount: 0.0001,
    usdPrice: 1,
  });
}

function dustRow(decision: ReturnType<typeof evaluateDustingAttack>) {
  return { id: decision.txHash, status: decision.status };
}
