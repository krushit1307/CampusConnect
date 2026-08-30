import { describe, expect, it } from "vitest";
import { donationSideEffects, interceptIncomingTransfer } from "../cryptoDustingFilterService";

describe("crypto dusting indexer (#5281)", () => {
  it("does not credit points, ledger, or push for dust", async () => {
    const decision = await interceptIncomingTransfer(
      {
        clubId: "club-1",
        walletAddress: "0xclub",
        chain: "ethereum",
        txHash: "0xdust",
        tokenContract: "0xobscure",
        tokenAmount: 5000,
        usdPrice: 0.0001,
      },
      [],
    );
    expect(donationSideEffects(decision)).toEqual({
      creditLedger: false,
      awardPoints: false,
      sendPush: false,
      status: "dropped_dust",
    });
  });

  it("prices a token via the oracle before accepting a real gift", async () => {
    const decision = await interceptIncomingTransfer(
      {
        clubId: "club-1",
        walletAddress: "0xclub",
        chain: "polygon",
        txHash: "0xgift",
        tokenContract: "0xusdctoken",
        tokenAmount: 12,
      },
      [],
      async () => 1,
    );
    expect(decision.fiatUsd).toBe(12);
    expect(donationSideEffects(decision).creditLedger).toBe(true);
  });
});
